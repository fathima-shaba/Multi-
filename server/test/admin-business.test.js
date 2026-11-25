import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { hashPassword } from '../src/auth/password.js';
import { csvCell } from '../src/admin/reports.js';

const pool = createPool(readConfig().databaseUrl);
const origin = 'http://localhost:5173';
const marker = randomUUID().slice(0, 8);
const day = '2004-02-29';
const window = '?from=' + day + '&to=' + day;
const productId = 'report-' + marker;
const accounts = [];
let server, base, admin, shopper;

async function hit(path, status, cookie, body, csrf = true) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : path === '/auth/login' ? 'POST' : 'PATCH',
    headers: {
      'X-Forwarded-For': '192.0.2.8',
      ...(cookie && { Cookie: cookie }),
      ...(body !== undefined && { 'Content-Type': 'application/json', ...(csrf && { Origin: origin, 'X-MultiStore-Request': '1' }) }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const csv = response.headers.get('content-type')?.includes('text/csv');
  const data = csv ? await response.text() : await response.json();
  assert.equal(response.status, status, data?.error?.message || path);
  return { data, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
}

async function account(role) {
  const credentials = { email: role + marker + '@example.test', password: randomUUID() };
  const { rows: [user] } = await pool.query(
    'INSERT INTO users(email,name,password_hash,role,created_at) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [credentials.email, 'Reporting ' + marker, await hashPassword(credentials.password), role, day + 'T00:00:00+05:30']);
  accounts.push(user.id);
  return { ...user, credentials, cookie: (await hit('/auth/login', 200, undefined, credentials)).cookie };
}

async function order(label, method, status, amount, payment, created = day + 'T00:00:00+05:30') {
  const { rows: [row] } = await pool.query(`INSERT INTO orders(user_id,order_number,status,subtotal_paise,delivery_paise,total_paise,
    shipping_snapshot,created_at,finalized_at,payment_method)
    VALUES($1,$2,$3,$4,0,$4,'{"private":"not-for-export"}',$5,$5,$6) RETURNING id`,
    [shopper.id, marker + '-' + label, status, amount, created, method]);
  if (payment) await pool.query(`INSERT INTO payments(order_id,provider,status,amount_paise,created_at,verified_at)
    VALUES($1,'razorpay',$2,$3,$4,$4)`, [row.id, payment, amount, created]);
  return row.id;
}

before(async () => {
  server = createApp({ pool, origins: [origin], trustProxy: 1 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port + '/api';
  admin = await account('admin');
  shopper = await account('customer');
  await pool.query(`INSERT INTO products(id,name,description,category_id,price_paise,stock,created_at)
    VALUES($1,'=1+1','Report test fixture','electronics',100,1,$2)`, [productId, day + 'T12:00:00+05:30']);
  const cod = await order('cod', 'demo_cod', 'Delivered', 1686300);
  await pool.query('INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price_paise) VALUES($1,$2,$3,2,843150)', [cod, productId, '=1+1']);
  await order('cancelled-cod', 'demo_cod', 'Cancelled', 50);
  await order('paid', 'razorpay', 'Processing', 24999, 'Captured');
  await order('unpaid', 'razorpay', 'Pending', 1000, 'Failed');
  await order('cancelled-card', 'razorpay', 'Cancelled', 250, 'Captured');
  await order('refunded', 'razorpay', 'Delivered', 301, 'Refunded');
  await order('next-day', 'demo_cod', 'Pending', 900, null, '2004-03-01T00:00:00+05:30');
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  try {
    if (accounts.length) {
      const filter = ' WHERE order_id IN (SELECT id FROM orders WHERE user_id=ANY($1::uuid[]))';
      for (const table of ['payments', 'order_items']) await pool.query('DELETE FROM ' + table + filter, [accounts]);
      await pool.query('DELETE FROM orders WHERE user_id=ANY($1::uuid[])', [accounts]);
      await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [accounts]);
    }
    await pool.query('DELETE FROM products WHERE id=$1', [productId]);
  } finally { await pool.end(); }
});

test('all administrator business endpoints require an administrator session', async () => {
  for (const path of ['dashboard', 'analytics/sales', 'analytics/products', 'analytics/customers', 'customers',
    'customers/' + shopper.id, 'activity', ...['orders', 'sales', 'products', 'inventory', 'payments'].map(kind => 'reports/' + kind)]) {
    await hit('/admin/' + path, 401);
    await hit('/admin/' + path, 403, shopper.cookie);
  }
});

test('dashboard counts match PostgreSQL and analytics isolate cancelled, refunded, test and unpaid records', async () => {
  const { data } = await hit('/admin/dashboard', 200, admin.cookie);
  for (const [key, sql] of Object.entries({ customers: "SELECT count(*) FROM users WHERE role='customer'",
    products: 'SELECT count(*) FROM products', categories: 'SELECT count(*) FROM categories',
    orders: 'SELECT count(*) FROM orders WHERE finalized_at IS NOT NULL',
    cancelled: "SELECT count(*) FROM orders WHERE finalized_at IS NOT NULL AND status='Cancelled'",
    reviews: 'SELECT count(*) FROM published_product_reviews' })) {
    assert.equal(data.stats[key], Number((await pool.query(sql)).rows[0].count), key);
  }
  assert.ok(BigInt(data.stats.unpaidOnlinePaise) >= 1000n);
  const { data: analytics } = await hit('/admin/analytics/sales' + window, 200, admin.cookie);
  assert.deepEqual(analytics.series, [{ date: day, orders: 6, completed: 2, demoCodPaise: '1686300', verifiedTestPaise: '24999' }]);
  assert.equal(analytics.statuses.find(item => item.name === 'Cancelled').count, 2);
  for (const [period, date] of [['week', '2004-02-23'], ['month', '2004-02-01']]) {
    assert.equal((await hit('/admin/analytics/sales' + window + '&period=' + period, 200, admin.cookie)).data.series[0].date, date);
  }
  assert.deepEqual((await hit('/admin/analytics/products' + window, 200, admin.cookie)).data.products,
    [{ id: productId, name: '=1+1', units: 2 }]);
  assert.equal((await hit('/admin/analytics/customers' + window, 200, admin.cookie)).data.series[0].count, 1);
  await hit('/admin/analytics/sales?from=2004-02-30&to=' + day, 400, admin.cookie);
  await hit('/admin/analytics/sales' + window + '&period=hour', 400, admin.cookie);
});

test('reports export private-field-free CSV with date and status filters and neutralize formula cells', async () => {
  for (const kind of ['orders', 'sales', 'products', 'inventory', 'payments']) {
    const { data, headers } = await hit('/admin/reports/' + kind + window, 200, admin.cookie);
    assert.match(headers.get('content-disposition'), new RegExp(kind + '\\.csv'));
    assert.doesNotMatch(data, /example\.test|not-for-export|password_hash|session_token|provider_payment_id/i);
    if (kind === 'sales') assert.match(data, /"1686300","24999"/);
    if (kind === 'products') assert.match(data, /"'=1\+1"/);
  }
  const { data } = await hit('/admin/reports/orders' + window + '&status=Cancelled', 200, admin.cookie);
  assert.equal((data.match(/"Cancelled"/g) || []).length, 2);
  assert.doesNotMatch(data, /next-day|refunded/);
  assert.equal(csvCell('  +1'), '"\'  +1"');
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell(-1), '"-1"');
  await hit('/admin/reports/products' + window + '&status=Archived', 400, admin.cookie);
});

test('customer filtering, order history, role isolation, session revocation and activity history work', async () => {
  const search = '/admin/customers?q=' + marker + '&status=';
  const path = '/admin/customers/' + shopper.id;
  const { data } = await hit(path, 200, admin.cookie);
  assert.equal(data.orders.length, 7);
  assert.equal(data.customer.id, shopper.id);
  assert.ok(!Object.hasOwn(data.customer, 'password_hash'));
  assert.deepEqual((await hit(search + 'Active', 200, admin.cookie)).data.customers.map(user => user.id), [shopper.id]);
  await hit('/admin/customers/' + admin.id + '/status', 404, admin.cookie, { active: false });
  await hit(path + '/status', 403, shopper.cookie, { active: false });
  await hit(path + '/status', 403, admin.cookie, { active: false }, false);
  await hit(path + '/status', 400, admin.cookie, { active: false, role: 'admin' });
  const second = (await hit('/auth/login', 200, undefined, shopper.credentials)).cookie;
  await hit(path + '/status', 200, admin.cookie, { active: false });
  assert.deepEqual((await hit(search + 'Inactive', 200, admin.cookie)).data.customers.map(user => user.id), [shopper.id]);
  await hit('/auth/me', 401, shopper.cookie);
  await hit('/auth/me', 401, second);
  await hit('/auth/login', 401, undefined, shopper.credentials);
  await hit(path + '/status', 200, admin.cookie, { active: true });
  await hit(path + '/status', 200, admin.cookie, { active: true });
  await hit('/auth/me', 401, second);
  await hit('/auth/login', 200, undefined, shopper.credentials);
  const { data: { activity } } = await hit('/admin/activity?q=' + shopper.id, 200, admin.cookie);
  assert.deepEqual(activity.map(row => row.action), ['customer.activated', 'customer.deactivated']);
  assert.ok(activity.every(row => row.actorName === 'Reporting ' + marker && row.targetId === shopper.id && row.createdAt));
});
