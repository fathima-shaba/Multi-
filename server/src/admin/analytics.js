import { dateWindow,localZone } from './reportFilters.js';

const placedNet = "status<>'Cancelled'";
const localDate = column => `${column} AT TIME ZONE '${localZone}'`;

export async function dashboard(pool) {
  const {rows:[result]}=await pool.query(`
    SELECT json_build_object(
      'customers',(SELECT count(*) FROM users WHERE role='customer'),
      'products',(SELECT count(*) FROM products),
      'categories',(SELECT count(*) FROM categories),
      'orders',(SELECT count(*) FROM reporting_orders),
      'completed',(SELECT count(*) FROM reporting_orders WHERE status='Delivered'),
      'pending',(SELECT count(*) FROM reporting_orders WHERE status='Pending'),
      'cancelled',(SELECT count(*) FROM reporting_orders WHERE status='Cancelled'),
      'awaitingPayment',(SELECT count(*) FROM orders WHERE reservation_state='Held' AND reservation_expires_at>now()),
      'verifiedTestPaise',(SELECT COALESCE(sum(amount_paise),0)::text FROM verified_test_receipts),
      'demoCodPaise',(SELECT COALESCE(sum(total_paise),0)::text FROM reporting_orders WHERE payment_method='demo_cod' AND ${placedNet}),
      'unpaidOnlinePaise',(SELECT COALESCE(sum(o.total_paise),0)::text FROM reporting_orders o WHERE o.payment_method='razorpay'
        AND o.status<>'Cancelled' AND NOT EXISTS(SELECT 1 FROM verified_test_receipts p WHERE p.order_id=o.id)
        AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.order_id=o.id AND p.status IN ('Captured','Refunded','RefundRequired','ReconciliationRequired'))),
      'lowStock',(SELECT count(*) FROM products p JOIN categories c ON c.id=p.category_id WHERE p.active AND c.active AND stock-reserved_stock BETWEEN 1 AND 5),
      'outOfStock',(SELECT count(*) FROM products p JOIN categories c ON c.id=p.category_id WHERE p.active AND c.active AND stock=reserved_stock),
      'reviews',(SELECT count(*) FROM published_product_reviews),
      'rating',(SELECT round(avg(rating),2) FROM published_product_reviews)
    ) AS stats,
    COALESCE((SELECT json_agg(o) FROM (SELECT id,order_number AS "orderNumber",status,payment_method AS "paymentMethod",
      total_paise AS "totalPaise",created_at AS "createdAt" FROM reporting_orders ORDER BY created_at DESC,id DESC LIMIT 5) o),'[]') AS "recentOrders",
    COALESCE((SELECT json_agg(u) FROM (SELECT id,name,active,created_at AS "createdAt" FROM users WHERE role='customer'
      ORDER BY created_at DESC,id DESC LIMIT 5) u),'[]') AS "recentCustomers",
    COALESCE((SELECT json_agg(i) FROM (SELECT t.id,p.name AS "productName",t.delta,t.created_at AS "createdAt"
      FROM inventory_transactions t JOIN products p ON p.id=t.product_id ORDER BY t.created_at DESC,t.id DESC LIMIT 5) i),'[]') AS "recentInventory"
  `);
  return result;
}

export async function salesSeries(pool,range,period) {
  const {rows}=await pool.query(`
    WITH buckets AS (SELECT generate_series(date_trunc($3,$1::date::timestamp),
        date_trunc($3,$2::date::timestamp), ('1 '||$3)::interval)::date AS day),
    placed AS (SELECT date_trunc($3,${localDate('created_at')})::date AS day,
        count(*)::int AS orders,count(*) FILTER(WHERE status='Delivered')::int AS completed,
        COALESCE(sum(total_paise) FILTER(WHERE payment_method='demo_cod' AND ${placedNet}),0) AS cod
      FROM reporting_orders WHERE ${dateWindow('created_at')} GROUP BY 1),
    captured AS (SELECT date_trunc($3,${localDate('verified_at')})::date AS day,sum(amount_paise) AS total
      FROM verified_test_receipts WHERE ${dateWindow('verified_at')} GROUP BY 1)
    SELECT to_char(b.day,'YYYY-MM-DD') AS date,COALESCE(p.orders,0) AS orders,COALESCE(p.completed,0) AS completed,
      COALESCE(p.cod,0)::text AS "demoCodPaise",COALESCE(c.total,0)::text AS "verifiedTestPaise"
    FROM buckets b LEFT JOIN placed p USING(day) LEFT JOIN captured c USING(day) ORDER BY b.day
  `,[...range,period]);
  return rows;
}

export async function salesAnalytics(pool,range,period) {
  const [series,{rows:[mix]}]=await Promise.all([
    salesSeries(pool,range,period),
    pool.query(`WITH placed AS (SELECT status,payment_method FROM reporting_orders WHERE ${dateWindow('created_at')})
      SELECT COALESCE((SELECT json_agg(s) FROM (SELECT status AS name,count(*)::int AS count FROM placed GROUP BY status ORDER BY status) s),'[]') AS statuses,
      COALESCE((SELECT json_agg(m) FROM (SELECT payment_method AS name,count(*)::int AS count FROM placed
        WHERE ${placedNet} GROUP BY payment_method ORDER BY payment_method) m),'[]') AS methods`,range),
  ]);
  return {series,...mix};
}

export async function productAnalytics(pool,range) {
  const {rows:[result]}=await pool.query(`WITH shipped AS (
    SELECT i.product_id,i.product_name,i.quantity,c.id AS category_id,c.name AS category
    FROM order_items i JOIN reporting_orders o ON o.id=i.order_id JOIN products p ON p.id=i.product_id
    JOIN categories c ON c.id=p.category_id
    WHERE o.status='Delivered' AND ${dateWindow('o.created_at')}
      AND (o.payment_method='demo_cod' OR EXISTS(SELECT 1 FROM verified_test_receipts t WHERE t.order_id=o.id))
  ) SELECT COALESCE((SELECT json_agg(top) FROM (SELECT product_id AS id,max(product_name) AS name,sum(quantity)::int AS units
      FROM shipped GROUP BY product_id ORDER BY units DESC,id LIMIT 10) top),'[]') AS products,
    COALESCE((SELECT json_agg(top) FROM (SELECT category_id AS id,max(category) AS name,sum(quantity)::int AS units
      FROM shipped GROUP BY category_id ORDER BY units DESC,id LIMIT 10) top),'[]') AS categories`,range);
  return result;
}

export async function customerAnalytics(pool,range,period) {
  const {rows}=await pool.query(`WITH buckets AS (SELECT generate_series(date_trunc($3,$1::date::timestamp),
      date_trunc($3,$2::date::timestamp),('1 '||$3)::interval)::date AS day),
    registrations AS (SELECT date_trunc($3,${localDate('created_at')})::date AS day,count(*)::int AS count
      FROM users WHERE role='customer' AND ${dateWindow('created_at')} GROUP BY 1)
    SELECT to_char(b.day,'YYYY-MM-DD') AS date,COALESCE(r.count,0) AS count FROM buckets b
    LEFT JOIN registrations r USING(day) ORDER BY b.day`,[...range,period]);
  return {series:rows};
}
