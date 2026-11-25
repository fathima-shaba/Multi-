import { HttpError } from '../http.js';
import { auditAdmin } from '../admin/activity.js';
import { transaction } from '../db.js';
import { lockAccount } from '../commerce/cart.js';
import { prepareCheckout, persistOrder } from '../commerce/orders.js';
import { changeStock } from '../admin/inventory.js';
import { closeReservation, expireReservations, releaseHeldStock, reserveStock } from './reservations.js';
import { gatewayCall, unavailable } from './gateway.js';

export const providerOrderPattern = /^order_[a-zA-Z0-9]{3,64}$/;
export const providerPaymentPattern = /^pay_[a-zA-Z0-9]{3,64}$/;
const knownMethods = new Set(['card','upi','netbanking','wallet','emi','paylater','cardless_emi','bank_transfer']);
const conflict = (code,message) => new HttpError(409,code,message);
const mismatch = () => conflict('PAYMENT_MISMATCH','Payment does not match the stored order.');

const columns = `p.id,p.order_id AS "orderId",p.provider,p.provider_order_id AS "providerOrderId",
  p.provider_payment_id AS "providerPaymentId",p.status,p.method,p.currency,p.amount_paise AS "amountPaise",
  p.failure_reason AS "failureReason",p.created_at AS "createdAt",p.updated_at AS "updatedAt",
  p.verified_at AS "verifiedAt",o.order_number AS "orderNumber",o.user_id AS "userId",
  o.reservation_state AS "reservationState",o.reservation_expires_at AS "expiresAt",o.finalized_at AS "finalizedAt"`;

export async function readPayment(client,orderId,userId = null,lock = false) {
  if (lock) await client.query('SELECT 1 FROM orders WHERE id=$1 FOR UPDATE',[orderId]);
  const {rows:[payment]}=await client.query(`SELECT ${columns} FROM payments p JOIN orders o ON o.id=p.order_id
    WHERE o.id=$1 AND ($2::uuid IS NULL OR o.user_id=$2)
    ORDER BY p.created_at DESC,p.id DESC LIMIT 1 ${lock ? 'FOR UPDATE OF p' : ''}`,[orderId,userId]);
  if (!payment) throw new HttpError(404,'PAYMENT_NOT_FOUND','Payment not found.');
  return payment;
}

export function publicPayment({userId:_owner,...payment}) {
  return payment;
}

export async function attachProviderOrder(pool,providerOrder) {
  if (!providerOrderPattern.test(providerOrder?.id) || providerOrder.currency!=='INR' ||
      typeof providerOrder.receipt!=='string' || !/^ORD-[A-F0-9]{32}$/.test(providerOrder.receipt)) throw mismatch();
  const {rows:[record]}=await pool.query(`UPDATE payments p SET provider_order_id=$1,
      status=CASE WHEN p.status IN ('Creating','CreationUnknown') THEN 'Pending' ELSE p.status END,
      failure_reason=CASE WHEN p.status IN ('Creating','CreationUnknown') THEN NULL ELSE p.failure_reason END,
      updated_at=now()
    FROM orders o WHERE o.id=p.order_id AND o.order_number=$2 AND p.provider='razorpay'
      AND p.amount_paise=$3 AND (p.provider_order_id IS NULL OR p.provider_order_id=$1)
    RETURNING p.order_id`,[providerOrder.id,providerOrder.receipt,providerOrder.amount]);
  if (!record) throw mismatch();
  return record.order_id;
}

export async function openCheckout(pool,gateway,orderId,userId) {
  if (!gateway) throw unavailable();
  await expireReservations(pool,userId);
  const payment=await readPayment(pool,orderId,userId);
  if (payment.provider!=='razorpay' || payment.reservationState!=='Held') {
    throw conflict('PAYMENT_CLOSED','This payment is closed. Check your receipt or start a new checkout.');
  }
  if (!payment.providerOrderId) {
    throw conflict('PAYMENT_NOT_READY','The gateway order is not ready. Check Order History before starting another checkout.');
  }
  if (payment.status==='Authorized') {
    throw conflict('PAYMENT_AUTHORIZED','A payment is awaiting capture. Check its status before retrying.');
  }
  return { orderId, checkout: { key:gateway.keyId,order_id:payment.providerOrderId,
    amount:payment.amountPaise,currency:'INR' }, expiresAt:payment.expiresAt };
}

export async function createOnlineOrder(pool,gateway,userId,body) {
  if (!gateway) throw unavailable();
  await expireReservations(pool,userId);
  const created=await transaction(pool,async client=>{
    const prepared=await prepareCheckout(client,userId,body,'razorpay');
    if (prepared.replayed) return prepared;
    if (prepared.cart.totals.totalPaise<100) throw conflict('PAYMENT_MINIMUM','Online payments require at least ₹1.');
    const orderId=await persistOrder(client,userId,prepared,'razorpay');
    await reserveStock(client,prepared.cart.items);
    await client.query("INSERT INTO payments(order_id,provider,status,amount_paise) VALUES($1,'razorpay','Creating',$2)",
      [orderId,prepared.cart.totals.totalPaise]);
    return {orderId};
  });
  if (!created.replayed) {
    const payment=await readPayment(pool,created.orderId,userId);
    try {
      const providerOrder=await gatewayCall(()=>gateway.createOrder({
        amount:payment.amountPaise,currency:'INR',receipt:payment.orderNumber,partial_payment:false,
      }));
      if (providerOrder.receipt!==payment.orderNumber || providerOrder.amount!==payment.amountPaise) throw mismatch();
      await attachProviderOrder(pool,providerOrder);
    } catch {
      await pool.query(`UPDATE payments SET status='CreationUnknown',failure_reason=$2,updated_at=now()
        WHERE order_id=$1 AND status='Creating'`,[created.orderId,'Gateway order creation could not be confirmed.']);
      throw new HttpError(503,'PAYMENT_CREATION_UNKNOWN','Gateway order creation could not be confirmed. Review or cancel the pending checkout in Order History.');
    }
  }
  return { ...await openCheckout(pool,gateway,created.orderId,userId), replayed:Boolean(created.replayed) };
}

export function validateProviderPayment(payment,observed,id) {
  if (!observed || !providerPaymentPattern.test(id) || observed.id!==id ||
      observed.order_id!==payment.providerOrderId || observed.amount!==payment.amountPaise || observed.currency!=='INR') throw mismatch();
}

export async function applyProviderPayment(client,payment,observed) {
  validateProviderPayment(payment,observed,observed.id);
  const orderId=payment.orderId;
  const providerId=observed.id;
  const method=knownMethods.has(observed.method)?observed.method:null;
  const update=async (status,reason=null)=>client.query(`UPDATE payments SET status=$2,provider_payment_id=$3,
    method=COALESCE($4,method),failure_reason=$5,verified_at=now(),updated_at=now()
    WHERE id=$1`,[payment.id,status,providerId,method,reason]);

  const captured=observed.status==='captured' && observed.captured===true;
  const refunded=observed.status==='refunded' && observed.refund_status==='full' && observed.amount_refunded===payment.amountPaise;
  if (['Captured','RefundRequired','ReconciliationRequired','Refunded'].includes(payment.status) &&
      (payment.providerPaymentId!==providerId || payment.status==='Refunded' ||
       (!refunded && !(captured && observed.amount_refunded>0 && payment.status==='Captured')))) return;
  if (refunded) {
    if (payment.reservationState==='Held') await closeReservation(client,orderId,'Cancelled');
    await update('Refunded');
    return;
  }
  if (!captured) {
    if (payment.reservationState!=='Held') return;
    if (observed.status==='authorized') await update('Authorized');
    if (observed.status==='failed' && (payment.status!=='Authorized' || payment.providerPaymentId===providerId)) {
      await update('Failed','Razorpay reported a failed payment. Retry before the reservation expires.');
    }
    return;
  }
  if (observed.amount_refunded > 0) {
    if (payment.reservationState==='Held') await closeReservation(client,orderId,'Cancelled');
    await update('ReconciliationRequired','A partial refund was reported. Review the gateway records.');
    return;
  }
  const {rows:[{current}]}=await client.query('SELECT reservation_expires_at>clock_timestamp() AS current FROM orders WHERE id=$1',[orderId]);
  if (payment.reservationState!=='Held' || !current) {
    if (payment.reservationState==='Held') await closeReservation(client,orderId,'Expired');
    await update('ReconciliationRequired','Payment captured after the stock reservation closed. Verify a full refund in Razorpay.');
    return;
  }

  const items=await releaseHeldStock(client,orderId);
  for (const item of items) {
    await changeStock(client,{productId:item.product_id,delta:-item.quantity,orderId,actorId:payment.userId,
      reason:'Verified Razorpay test payment',operationKey:orderId+':purchase:'+item.product_id});
    await client.query('DELETE FROM cart_items WHERE user_id=$1 AND product_id=$2 AND quantity<=$3',
      [payment.userId,item.product_id,item.quantity]);
    await client.query('UPDATE cart_items SET quantity=quantity-$3,updated_at=now() WHERE user_id=$1 AND product_id=$2',
      [payment.userId,item.product_id,item.quantity]);
  }
  await client.query(`UPDATE orders SET reservation_state='Consumed',finalized_at=now(),
    status='Processing',updated_at=now() WHERE id=$1`,[orderId]);
  await client.query("INSERT INTO order_status_events(order_id,status) VALUES($1,'Processing')",[orderId]);
  await update('Captured');
}

export async function reconcilePayment(pool,orderId,observed,actorId) {
  const candidate=await readPayment(pool,orderId);
  await transaction(pool,async client=>{
    await lockAccount(client,candidate.userId);
    const current=await readPayment(client,orderId,null,true);
    await applyProviderPayment(client,current,observed);
    if(actorId) await auditAdmin(client,actorId,'payment.reconciled','payment',current.id);
  });
  return publicPayment(await readPayment(pool,orderId));
}

export async function reconcileOrder(pool,gateway,payment,actorId) {
  if (!gateway) throw unavailable();
  if (payment.provider!=='razorpay' || !payment.providerOrderId) {
    throw conflict('PAYMENT_NOT_READY','A linked Razorpay order is required to check payment status.');
  }
  if (payment.providerPaymentId && ['Captured','RefundRequired','ReconciliationRequired'].includes(payment.status)) {
    const observed=await gatewayCall(()=>gateway.fetchPayment(payment.providerPaymentId));
    if (observed.id!==payment.providerPaymentId) throw mismatch();
    return reconcilePayment(pool,payment.orderId,observed,actorId);
  }
  const result=await gatewayCall(()=>gateway.fetchOrderPayments(payment.providerOrderId));
  const items=Array.isArray(result?.items)?result.items:[];
  const paymentByStatus=status=>items.filter(item=>item.status===status).sort((a,b)=>Number(b.created_at)-Number(a.created_at))[0];
  const observed=paymentByStatus('refunded') || paymentByStatus('captured') || paymentByStatus('authorized') || paymentByStatus('failed');
  if(observed) return reconcilePayment(pool,payment.orderId,observed,actorId);
  if(actorId) await auditAdmin(pool,actorId,'payment.reconciled','payment',payment.id);
  return publicPayment(payment);
}

export async function listPayments(pool,query) {
  const { q='',status='',offset='0' }=query;
  if (typeof q!=='string'||q.length>120||q.includes('\0')||typeof status!=='string'||
      !['','Creating','CreationUnknown','Pending','Authorized','Captured','Failed','Expired','Cancelled','RefundRequired','ReconciliationRequired','Refunded'].includes(status)||
      typeof offset!=='string'||!/^\d{1,6}$/.test(offset)||Number(offset)>100000) {
    throw new HttpError(400,'INVALID_FILTER','Invalid payment filter.');
  }
  const {rows}=await pool.query(`SELECT ${columns} FROM payments p JOIN orders o ON o.id=p.order_id
    WHERE ($1='' OR strpos(lower(concat_ws(' ',p.id,o.id,o.order_number,p.provider_order_id,p.provider_payment_id)),lower($1))>0)
      AND ($2='' OR p.status=$2) ORDER BY p.created_at DESC,p.id DESC LIMIT 26 OFFSET $3`,[q.trim(),status,Number(offset)]);
  return {payments:rows.slice(0,25).map(publicPayment),nextOffset:rows.length>25?Number(offset)+25:null};
}
