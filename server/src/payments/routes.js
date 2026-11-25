import { Router, raw } from 'express';
import { auditAdmin } from '../admin/activity.js';
import { transaction } from '../db.js';
import { HttpError } from '../http.js';
import { addressId, fields, invalid } from '../auth/validation.js';
import { lockAccount } from '../commerce/cart.js';
import { expireReservations } from './reservations.js';
import { gatewayCall, signatureMatches, unavailable } from './gateway.js';
import {
  applyProviderPayment, attachProviderOrder, createOnlineOrder, listPayments, openCheckout,
  providerOrderPattern, providerPaymentPattern, publicPayment, readPayment, reconcileOrder, reconcilePayment,
} from './service.js';

const events = new Set(['payment.captured','payment.failed','payment.authorized','order.paid','refund.processed']);

export function webhookHandlers(pool,gateway) {
  return [raw({type:'application/json',limit:'128kb',inflate:false}),async (request,response)=>{
    if (!gateway) throw unavailable();
    const eventId=request.get('x-razorpay-event-id');
    if (!Buffer.isBuffer(request.body) || !signatureMatches(request.body,request.get('x-razorpay-signature'),gateway.webhookSecret)) {
      throw new HttpError(400,'INVALID_WEBHOOK_SIGNATURE','Webhook signature is invalid.');
    }
    if (!eventId || !/^[\w-]{1,128}$/.test(eventId)) invalid('Missing or invalid webhook event identifier.');
    let envelope;
    try { envelope=JSON.parse(request.body.toString('utf8')); }
    catch { invalid('Invalid webhook body.'); }
    if (!events.has(envelope?.event)) return response.sendStatus(204);
    const duplicate=await pool.query('SELECT 1 FROM payment_webhook_events WHERE event_id=$1',[eventId]);
    if (duplicate.rowCount) return response.sendStatus(204);

    const id=envelope.payload?.payment?.entity?.id || envelope.payload?.refund?.entity?.payment_id;
    if (!providerPaymentPattern.test(id)) invalid('Webhook payment ID is invalid.');
    const observed=await gatewayCall(()=>gateway.fetchPayment(id));
    if (observed.id!==id || !providerOrderPattern.test(observed.order_id)) invalid('Invalid payment reference.');
    let linked=(await pool.query(`SELECT order_id FROM payments WHERE provider='razorpay' AND provider_order_id=$1`,[observed.order_id])).rows[0]?.order_id;
    if (!linked) {
      const providerOrder=await gatewayCall(()=>gateway.fetchOrder(observed.order_id));
      if (providerOrder.id!==observed.order_id) invalid('Gateway order reference did not match.');
      // Other integrations may use the same Razorpay test account.
      const belongs=await pool.query("SELECT 1 FROM orders WHERE order_number=$1 AND payment_method='razorpay'",[providerOrder.receipt]);
      if (!belongs.rowCount) return response.sendStatus(204);
      linked=await attachProviderOrder(pool,providerOrder);
    }
    const payment=await readPayment(pool,linked);
    await transaction(pool,async client=>{
      await lockAccount(client,payment.userId);
      const inserted=await client.query(`INSERT INTO payment_webhook_events(event_id,event_type)
        VALUES($1,$2) ON CONFLICT DO NOTHING`,[eventId,envelope.event]);
      if (inserted.rowCount) await applyProviderPayment(client,await readPayment(client,linked,null,true),observed);
    });
    response.sendStatus(204);
  }];
}

export function paymentRoutes(pool,gateway,requireUser) {
  const router=Router();
  router.get('/payments/razorpay/config',requireUser,(_request,response)=>response.json({available:Boolean(gateway)}));
  router.post('/payments/razorpay/order',requireUser,async (request,response)=>{
    const {replayed,...result}=await createOnlineOrder(pool,gateway,response.locals.user.id,request.body);
    response.status(replayed?200:201).json(result);
  });
  router.post('/payments/razorpay/:id/resume',requireUser,async (request,response)=>{
    response.json(await openCheckout(pool,gateway,addressId(request.params.id),response.locals.user.id));
  });
  router.post('/payments/razorpay/verify',requireUser,async (request,response)=>{
    if (!gateway) throw unavailable();
    const {orderId,razorpay_order_id:providerOrder,razorpay_payment_id:providerPayment,razorpay_signature:signature}=
      fields(request.body,['orderId','razorpay_order_id','razorpay_payment_id','razorpay_signature']);
    const payment=await readPayment(pool,addressId(orderId),response.locals.user.id);
    if (payment.provider!=='razorpay' || !providerOrderPattern.test(providerOrder) ||
      providerOrder!==payment.providerOrderId || !providerPaymentPattern.test(providerPayment) ||
      !signatureMatches(payment.providerOrderId+'|'+providerPayment,signature,gateway.keySecret)) {
      throw new HttpError(400,'INVALID_PAYMENT_SIGNATURE','Payment signature or order reference is invalid.');
    }
    const observed=await gatewayCall(()=>gateway.fetchPayment(providerPayment));
    if (observed.id!==providerPayment) invalid('Gateway payment reference did not match.');
    response.json({payment:await reconcilePayment(pool,payment.orderId,observed)});
  });
  router.get('/orders/:id/payment',requireUser,async (request,response)=>{
    const userId=response.locals.user.id;
    await expireReservations(pool,userId);
    response.json({payment:publicPayment(await readPayment(pool,addressId(request.params.id),userId))});
  });
  router.post('/orders/:id/payment/check',requireUser,async (request,response)=>{
    const payment=await readPayment(pool,addressId(request.params.id),response.locals.user.id);
    response.json({payment:await reconcileOrder(pool,gateway,payment)});
  });
  return router;
}

export function adminPaymentRoutes(pool,gateway) {
  const router=Router();
  router.get('/payments',async(request,response)=>response.json(await listPayments(pool,request.query)));
  router.post('/payments/:id/reconcile',async(request,response)=>{
    if (!gateway) throw unavailable();
    const input=fields(request.body,['providerOrderId']);
    const {rows:[record]}=await pool.query('SELECT order_id FROM payments WHERE id=$1 AND provider=\'razorpay\'',[addressId(request.params.id)]);
    if (!record) throw new HttpError(404,'PAYMENT_NOT_FOUND','Online payment not found.');
    let payment=await readPayment(pool,record.order_id);
    if (input.providerOrderId!==undefined) {
      if (!providerOrderPattern.test(input.providerOrderId)) invalid('Invalid Razorpay order ID.');
      const order=await gatewayCall(()=>gateway.fetchOrder(input.providerOrderId));
      if (order.id!==input.providerOrderId || order.receipt!==payment.orderNumber || order.amount!==payment.amountPaise) invalid('Gateway order does not match this payment.');
      await transaction(pool,async client=>{
        await attachProviderOrder(client,order);
        await auditAdmin(client,response.locals.user.id,'payment.linked','payment',payment.id);
      });
      payment=await readPayment(pool,record.order_id);
    }
    response.json({payment:await reconcileOrder(pool,gateway,payment,response.locals.user.id)});
  });
  return router;
}
