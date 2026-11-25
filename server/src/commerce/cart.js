import { fingerprint } from '../auth/sessions.js';
import { invalid } from '../auth/validation.js';
import { HttpError } from '../http.js';

export const maxQuantity = 999;

export function productId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) invalid('Invalid product ID.');
  return value;
}

export function quantity(value) {
  if (!Number.isInteger(value) || value < 1 || value > maxQuantity) invalid('Quantity must be a whole number from 1 to 999.');
  return value;
}

export async function lockAccount(client, userId) {
  await client.query('SELECT 1 FROM users WHERE id=$1 FOR NO KEY UPDATE', [userId]);
}

export const productColumns = `p.id,p.name,p.brand,p.stock-p.reserved_stock AS stock,p.price_paise AS "pricePaise",
  p.original_price_paise AS "originalPricePaise",p.discount_percent AS discount,
  (p.active AND c.active) AS available,
  (SELECT i.url FROM product_images i WHERE i.product_id=p.id ORDER BY i.position LIMIT 1) AS image`;

export async function readCart(client, userId) {
  const { rows } = await client.query(`SELECT ${productColumns},ci.quantity
    FROM cart_items ci JOIN products p ON p.id=ci.product_id JOIN categories c ON c.id=p.category_id
    WHERE ci.user_id=$1 ORDER BY ci.created_at,p.id`, [userId]);
  const items = rows.map(item => ({
    ...item, lineTotalPaise: item.pricePaise * item.quantity,
    valid: item.available && item.quantity <= item.stock && item.quantity <= maxQuantity,
  }));
  const totals = { quantity: 0, mrpPaise: 0, subtotalPaise: 0 };
  for (const item of items) {
    totals.quantity += item.quantity;
    totals.mrpPaise += (item.originalPricePaise ?? item.pricePaise) * item.quantity;
    totals.subtotalPaise += item.lineTotalPaise;
  }
  totals.discountPaise = totals.mrpPaise - totals.subtotalPaise;
  totals.deliveryPaise = items.length && totals.subtotalPaise <= 50000 ? 4000 : 0;
  totals.totalPaise = totals.subtotalPaise + totals.deliveryPaise;
  const signature = items.map(item => [item.id, item.quantity, item.pricePaise, item.originalPricePaise]);
  return { items, totals, quoteVersion: fingerprint(JSON.stringify(signature)), currency: 'INR' };
}

export async function writeCartItem(client, userId, id, amount, add = false) {
  const { rows: [item] } = await client.query('SELECT quantity FROM cart_items WHERE user_id=$1 AND product_id=$2', [userId,id]);
  if (!add && !item) throw new HttpError(404, 'CART_ITEM_NOT_FOUND', 'Cart item not found.');
  const next = add ? amount + (item?.quantity ?? 0) : amount;
  if (next > maxQuantity) invalid('The cart supports up to 999 units per product.');

  // Customers can reduce an unavailable line before removing it.
  if (!item || next > item.quantity || add) {
    const { rows: [product] } = await client.query(`SELECT p.stock-p.reserved_stock AS stock, p.active AND c.active AS available
      FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=$1`, [id]);
    if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    if (!product.available || next > product.stock) {
      throw new HttpError(409, 'STOCK_UNAVAILABLE', 'The requested quantity is no longer available.');
    }
  }
  if (!item) {
    const { rows: [count] } = await client.query('SELECT count(*)::int AS total FROM cart_items WHERE user_id=$1', [userId]);
    if (count.total >= 100) invalid('The cart supports up to 100 different products.');
  }
  await client.query(`INSERT INTO cart_items(user_id,product_id,quantity) VALUES($1,$2,$3)
    ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity,updated_at=now()`, [userId,id,next]);
}

export async function readWishlist(client, userId) {
  const { rows } = await client.query(`SELECT ${productColumns}
    FROM wishlist_items w JOIN products p ON p.id=w.product_id JOIN categories c ON c.id=p.category_id
    WHERE w.user_id=$1 ORDER BY w.created_at DESC,p.id`, [userId]);
  return rows;
}
