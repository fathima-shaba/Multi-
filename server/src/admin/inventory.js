import { randomUUID } from 'node:crypto';
import { HttpError } from '../http.js';

export function missingProduct() {
  return new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
}

// Use the caller's transaction so a future order and its stock movements can commit together.
export async function changeStock(client, { productId, delta, quantity, reason, actorId, orderId = null, operationKey = randomUUID() }) {
  const { rows: [product] } = await client.query('SELECT stock,reserved_stock FROM products WHERE id = $1 FOR UPDATE', [productId]);
  if (!product) throw missingProduct();
  const next = quantity ?? product.stock + delta;
  if (!Number.isInteger(next) || next < 0 || next > 2147483647) {
    throw new HttpError(409, 'INVALID_STOCK', 'The adjustment would make stock fall outside the supported range.');
  }
  if (next < product.reserved_stock) {
    throw new HttpError(409,'STOCK_RESERVED','Stock cannot be set below the number of units reserved for online checkout.');
  }
  const applied = next - product.stock;
  if (!applied) return next;
  await client.query('UPDATE products SET stock = $2, updated_at = now() WHERE id = $1', [productId, next]);
  await client.query(`INSERT INTO inventory_transactions(product_id, order_id, actor_user_id, delta, reason, operation_key)
    VALUES ($1,$2,$3,$4,$5,$6)`, [productId, orderId, actorId, applied, reason, operationKey]);
  return next;
}
