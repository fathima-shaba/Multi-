import { randomUUID } from 'node:crypto';
import { HttpError } from '../http.js';
import { addressId, fields, invalid, text } from '../auth/validation.js';
import { addressColumns, addressValues } from '../auth/addresses.js';
import { fingerprint } from '../auth/sessions.js';
import { changeStock } from '../admin/inventory.js';
import { lockAccount, readCart } from './cart.js';
import { closeReservation } from '../payments/reservations.js';
import { auditAdmin } from '../admin/activity.js';

const maxInteger = 2147483647;
export const transitions = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

const orderColumns = `o.id, o.order_number AS "orderNumber", o.status, o.currency,
  o.subtotal_paise AS "subtotalPaise", o.delivery_paise AS "deliveryPaise", o.discount_paise AS "discountPaise",
  o.total_paise AS "totalPaise", o.created_at AS "createdAt",o.payment_method AS "paymentMethod",
  o.finalized_at AS "finalizedAt",o.reservation_expires_at AS "reservationExpiresAt",
  COALESCE((SELECT status FROM payments WHERE order_id=o.id ORDER BY created_at DESC,id DESC LIMIT 1),'Pending') AS "paymentStatus"`;
const orderItemsSql = `COALESCE((SELECT json_agg(item ORDER BY item."productId") FROM (
  SELECT i.product_id AS "productId",i.product_name AS name,i.quantity,i.unit_price_paise AS "pricePaise",i.image_url AS image
  FROM order_items i WHERE i.order_id=o.id
) item),'[]')`;

const notFound = () => new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');
const conflict = (code, message) => new HttpError(409, code, message);

export async function orderDetails(client, id, userId = null) {
  const { rows: [order] } = await client.query(`SELECT ${orderColumns}, o.shipping_snapshot AS "shippingAddress",
    CASE WHEN $2::uuid IS NULL THEN json_build_object('name',u.name,'email',u.email) END AS customer,
    ${orderItemsSql} AS items,
    COALESCE((SELECT json_agg(event ORDER BY event.sequence) FROM (
      SELECT e.id AS sequence,e.status,e.created_at AS "createdAt",e.actor_user_id AS "actorId",actor.name AS "actorName"
      FROM order_status_events e LEFT JOIN users actor ON actor.id=e.actor_user_id WHERE e.order_id=o.id
    ) event),'[]') AS timeline
    FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=$1 AND ($2::uuid IS NULL OR o.user_id=$2)`, [id,userId]);
  if (!order) throw notFound();
  const allowed = order.paymentMethod==='razorpay' && !order.finalizedAt
    ? transitions[order.status].filter(status=>status==='Cancelled') : transitions[order.status];
  return { ...order, timeline: userId ? order.timeline.map(({ status, createdAt }) => ({ status, createdAt })) : order.timeline,
    allowedStatuses: userId ? [] : allowed,
    canCancel: allowed.includes('Cancelled') && (!userId || order.paymentMethod!=='razorpay' || !order.finalizedAt) };
}

async function shippingAddress(client, userId, savedId, address) {
  if (savedId) {
    const { rows: [saved] } = await client.query(`SELECT ${addressColumns} FROM addresses WHERE id=$1 AND user_id=$2`, [savedId,userId]);
    if (!saved) throw new HttpError(404, 'ADDRESS_NOT_FOUND', 'Shipping address not found.');
    const { id: _id, ...snapshot } = saved;
    return snapshot;
  }
  const values = addressValues(address);
  return Object.fromEntries(['recipient','phone','addressLine','locality','city','state','pincode','countryCode']
    .map((key,index) => [key, index === 7 ? 'IN' : values[index]]));
}

export async function prepareCheckout(client, userId, body, paymentMethod) {
  const input = fields(body, ['addressId','address','quoteVersion','idempotencyKey']);
  const token = addressId(input.idempotencyKey);
  if (typeof input.quoteVersion !== 'string' || !/^[0-9a-f]{64}$/.test(input.quoteVersion)) invalid('Refresh the cart quote.');
  if ((input.addressId === undefined) === (input.address === undefined)) invalid('Select a saved address or enter a new address.');
  const savedId = input.addressId === undefined ? null : addressId(input.addressId);
  const requestDigest = fingerprint(JSON.stringify([savedId, savedId ? null : addressValues(input.address), input.quoteVersion]));

  await lockAccount(client,userId);
  const { rows: [previous] } = await client.query('SELECT id,request_digest,payment_method FROM orders WHERE user_id=$1 AND idempotency_key=$2',[userId,token]);
  if (previous) {
    if (previous.request_digest !== requestDigest || previous.payment_method!==paymentMethod) throw conflict('IDEMPOTENCY_CONFLICT', 'This checkout key belongs to a different request.');
    return { orderId: previous.id, replayed: true };
  }
  const held = await client.query("SELECT 1 FROM orders WHERE user_id=$1 AND reservation_state='Held'",[userId]);
  if (held.rowCount) throw conflict('ACTIVE_RESERVATION','Resume or cancel your existing online checkout from Order History.');

  await client.query(`SELECT p.id FROM products p JOIN cart_items ci ON ci.product_id=p.id
    WHERE ci.user_id=$1 ORDER BY p.id FOR UPDATE OF p`,[userId]);
  await client.query(`SELECT c.id FROM categories c WHERE c.id IN
    (SELECT p.category_id FROM products p JOIN cart_items ci ON ci.product_id=p.id WHERE ci.user_id=$1)
    ORDER BY c.id FOR SHARE OF c`, [userId]);
  const cart = await readCart(client,userId);
  if (!cart.items.length) throw conflict('EMPTY_CART', 'Add products before checkout.');
  if (cart.items.some(item => !item.valid)) throw conflict('STOCK_UNAVAILABLE', 'Update unavailable items before checkout.');
  if (cart.quoteVersion !== input.quoteVersion) throw conflict('QUOTE_CHANGED', 'Prices or quantities changed. Review your cart before placing the order.');
  if (cart.totals.totalPaise > maxInteger || cart.totals.discountPaise > maxInteger) invalid('This order exceeds the supported amount.');
  const shipping = await shippingAddress(client,userId,savedId,input.address);
  return { cart, shipping, token, requestDigest };
}

export async function persistOrder(client,userId,prepared,paymentMethod) {
  const { cart,shipping,token,requestDigest } = prepared;
  const id = randomUUID();
  const number = 'ORD-' + id.replaceAll('-', '').toUpperCase();
  const { subtotalPaise, deliveryPaise, totalPaise, discountPaise } = cart.totals;
  await client.query(`INSERT INTO orders(id,user_id,order_number,idempotency_key,request_digest,
    subtotal_paise,delivery_paise,total_paise,discount_paise,shipping_snapshot,payment_method,
    reservation_state,reservation_expires_at,finalized_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
      CASE WHEN $11='razorpay' THEN 'Held' ELSE 'None' END,
      CASE WHEN $11='razorpay' THEN now()+interval '15 minutes' END,
      CASE WHEN $11<>'razorpay' THEN now() END)`,
  [id,userId,number,token,requestDigest,subtotalPaise,deliveryPaise,totalPaise,discountPaise,JSON.stringify(shipping),paymentMethod]);
  for (const item of cart.items) {
    await client.query(`INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price_paise,image_url)
      VALUES($1,$2,$3,$4,$5,$6)`,[id,item.id,item.name,item.quantity,item.pricePaise,item.image]);
  }
  return id;
}

export async function checkout(client, userId, body) {
  const prepared=await prepareCheckout(client,userId,body,'demo_cod');
  if (prepared.replayed) return prepared;
  const {cart}=prepared;
  const id=await persistOrder(client,userId,prepared,'demo_cod');
  for (const item of cart.items) {
    await changeStock(client,{ productId: item.id, delta: -item.quantity, orderId: id, actorId: userId,
      reason: 'Order placed', operationKey: id + ':purchase:' + item.id });
  }
  await client.query("INSERT INTO payments(order_id,provider,status,amount_paise,method) VALUES($1,'demo_cod','Pending',$2,'cod')",[id,cart.totals.totalPaise]);
  await client.query("INSERT INTO order_status_events(order_id,status,actor_user_id) VALUES($1,'Pending',$2)",[id,userId]);
  await client.query('DELETE FROM cart_items WHERE user_id=$1 AND product_id=ANY($2::text[])',[userId,cart.items.map(item=>item.id)]);
  return { orderId: id, replayed: false };
}

export async function changeStatus(client, orderId, status, actorId, admin) {
  const { rows: [order] } = await client.query(`SELECT status,payment_method,reservation_state,finalized_at FROM orders
    WHERE id=$1 AND ($2 OR user_id=$3) FOR UPDATE`, [orderId,admin,actorId]);
  if (!order) throw notFound();
  if (order.status === status && status === 'Cancelled') return;
  if ((!admin && status !== 'Cancelled') || !transitions[order.status].includes(status)) {
    throw conflict('INVALID_STATUS_TRANSITION', 'That status change is unavailable for this order.');
  }
  if (order.payment_method==='razorpay' && !order.finalized_at) {
    if (status!=='Cancelled' || order.reservation_state!=='Held') {
      throw conflict('PAYMENT_REQUIRED','Verify the online payment before fulfilling this order.');
    }
    await closeReservation(client,orderId,'Cancelled',actorId);
    if(admin) await auditAdmin(client,actorId,'order.status_changed','order',orderId);
    return;
  }
  if (!admin && order.payment_method==='razorpay') {
    throw conflict('REFUND_REQUIRED','Contact the store to cancel a paid online order.');
  }
  if (order.payment_method==='razorpay' && status!=='Cancelled') {
    const captured=await client.query("SELECT 1 FROM payments WHERE order_id=$1 AND provider='razorpay' AND status='Captured'",[orderId]);
    if (!captured.rowCount) throw conflict('PAYMENT_REQUIRED','Verify the online payment before fulfilling this order.');
  }
  if (status === 'Cancelled') {
    const { rows } = await client.query('SELECT product_id,quantity FROM order_items WHERE order_id=$1 ORDER BY product_id',[orderId]);
    for (const item of rows) {
      await changeStock(client,{ productId:item.product_id, delta:item.quantity, orderId, actorId,
        reason:'Order cancelled', operationKey:orderId + ':cancel:' + item.product_id });
    }
    await client.query("UPDATE payments SET status='Cancelled',updated_at=now() WHERE order_id=$1 AND provider='demo_cod' AND status='Pending'",[orderId]);
    await client.query("UPDATE payments SET status='RefundRequired',updated_at=now() WHERE order_id=$1 AND provider='razorpay' AND status='Captured'",[orderId]);
  }
  await client.query('UPDATE orders SET status=$2,updated_at=now() WHERE id=$1',[orderId,status]);
  await client.query('INSERT INTO order_status_events(order_id,status,actor_user_id) VALUES($1,$2,$3)',[orderId,status,actorId]);
  if(admin) await auditAdmin(client,actorId,'order.status_changed','order',orderId);
}

export async function orderList(client, userId, query) {
  const status = query.status ?? '';
  if (userId === null && (typeof status !== 'string' || (status && !Object.hasOwn(transitions,status)))) invalid('Invalid status filter.');
  const q = userId === null && query.q !== undefined ? text(query.q,'Search',0,254) : '';
  const rawOffset = query.offset ?? '0';
  if (typeof rawOffset !== 'string' || !/^\d{1,6}$/.test(rawOffset) || Number(rawOffset)>100000) invalid('Invalid order offset.');
  const offset = Number(rawOffset);
  const { rows } = await client.query(`SELECT ${orderColumns},
    CASE WHEN $1::uuid IS NULL THEN json_build_object('name',u.name,'email',u.email) END AS customer,
    CASE WHEN $1::uuid IS NOT NULL THEN ${orderItemsSql} ELSE '[]'::json END AS items
    FROM orders o JOIN users u ON u.id=o.user_id
    WHERE ($1::uuid IS NULL OR o.user_id=$1) AND ($2='' OR o.status=$2)
      AND ($3='' OR strpos(lower(concat_ws(' ',o.order_number,o.id,u.name,u.email)),lower($3))>0)
    ORDER BY o.created_at DESC,o.id DESC LIMIT 26 OFFSET $4`,[userId,userId === null ? status : '',q,offset]);
  return { orders:rows.slice(0,25),nextOffset:rows.length>25 ? offset+25 : null };
}
