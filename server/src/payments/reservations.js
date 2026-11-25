import { transaction } from '../db.js';
import { HttpError } from '../http.js';

export async function reserveStock(client, items) {
  for (const item of [...items].sort((a,b)=>a.id.localeCompare(b.id))) {
    const result = await client.query(`UPDATE products SET reserved_stock=reserved_stock+$2
      WHERE id=$1 AND stock-reserved_stock >= $2`,[item.id,item.quantity]);
    if (!result.rowCount) throw new HttpError(409,'STOCK_UNAVAILABLE','The requested stock is no longer available.');
  }
}

export async function releaseHeldStock(client, orderId) {
  const { rows } = await client.query('SELECT product_id,quantity FROM order_items WHERE order_id=$1 ORDER BY product_id',[orderId]);
  for (const item of rows) {
    const result = await client.query(`UPDATE products SET reserved_stock=reserved_stock-$2
      WHERE id=$1 AND reserved_stock >= $2`,[item.product_id,item.quantity]);
    if (!result.rowCount) throw new Error('Inventory hold is inconsistent');
  }
  return rows;
}

// Call with the order row locked. Held quantities have not reduced on-hand stock.
export async function closeReservation(client, orderId, paymentStatus, actorId = null) {
  await releaseHeldStock(client,orderId);
  await client.query("UPDATE orders SET reservation_state='Released',status='Cancelled',updated_at=now() WHERE id=$1",[orderId]);
  await client.query(`UPDATE payments SET status=$2, failure_reason=$3,updated_at=now()
    WHERE order_id=$1 AND provider='razorpay'`,
  [orderId,paymentStatus,paymentStatus==='Expired'?'Stock reservation expired.':'Payment checkout was cancelled.']);
  await client.query("INSERT INTO order_status_events(order_id,status,actor_user_id) VALUES($1,'Cancelled',$2)",[orderId,actorId]);
}

export async function expireReservations(pool, userId = null) {
  const { rows } = await pool.query(`SELECT id FROM orders WHERE reservation_state='Held'
    AND reservation_expires_at<=clock_timestamp() AND ($1::uuid IS NULL OR user_id=$1)
    ORDER BY reservation_expires_at LIMIT 50`,[userId]);
  for (const {id} of rows) {
    await transaction(pool,async client=>{
      const result=await client.query(`SELECT 1 FROM orders WHERE id=$1 AND reservation_state='Held'
        AND reservation_expires_at<=clock_timestamp() FOR UPDATE SKIP LOCKED`,[id]);
      if (result.rowCount) await closeReservation(client,id,'Expired');
    });
  }
}
