import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { createPool, transaction } from '../src/db.js';
import { hashPassword } from '../src/auth/password.js';

const origin = 'http://localhost:5173';
const pool = createPool(readConfig().databaseUrl);
const suffix = randomUUID().slice(0, 8);
const users = [];
const ids = {};
let server, base, admin, customer;

async function request(path, status, { method = 'GET', body, cookie, csrf = true } = {}) {
  const response = await fetch(base + path, { method, headers: {
    ...(cookie ? { Cookie: cookie } : {}),
    ...(method === 'GET' || !csrf ? {} : { Origin: origin, 'X-MultiStore-Request': '1' }),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  }, body: body && JSON.stringify(body) });
  const data = response.status === 204 ? null : await response.json();
  assert.equal(response.status, status, data?.error?.message);
  return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function signIn(role) {
  const email = role + '-' + suffix + '@example.test';
  const password = randomUUID();
  const record = await pool.query('INSERT INTO users(email,name,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id',
    [email, 'Catalog Test Operator', await hashPassword(password), role]);
  users.push(record.rows[0].id);
  const login = await request('/auth/login', 200, { method: 'POST', body: { email, password } });
  return login.cookie;
}

const create = (path, status, body, cookie = admin) => request('/admin' + path, status, { method: 'POST', body, cookie });
const patch = (path, status, body) => request('/admin' + path, status, { method: 'PATCH', body, cookie: admin });
const remove = (path, status) => request('/admin' + path, status, { method: 'DELETE', cookie: admin });

before(async () => {
  server = createApp({ pool, origins: [origin] }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port + '/api';
  admin = await signIn('admin');
  customer = await signIn('customer');
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  try {
    await transaction(pool, async client => {
      if (ids.order) {
        await client.query('DELETE FROM order_items WHERE order_id=$1', [ids.order]);
        await client.query('DELETE FROM orders WHERE id=$1', [ids.order]);
      }
      if (ids.product) {
        await client.query('DELETE FROM inventory_transactions WHERE product_id=$1', [ids.product]);
        await client.query('DELETE FROM products WHERE id=$1', [ids.product]);
      }
      if (ids.category) await client.query('DELETE FROM categories WHERE id=$1', [ids.category]);
      if (users.length) await client.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
    });
  } finally {
    await pool.end();
  }
});

test('admin role and CSRF are enforced for the management API', async () => {
  for (const path of ['/products','/categories','/inventory','/inventory/transactions']) {
    await request('/admin' + path, 401);
    await request('/admin' + path, 403, { cookie: customer });
  }
  await request('/admin/products', 403, { method: 'POST', body: {}, cookie: admin, csrf: false });
  await create('/products', 403, {}, customer);
});

test('admin persists products and categories and public reads reflect their availability', async () => {
  const category = await create('/categories', 201, { name: 'Lab Category ' + suffix, description: 'First description' });
  ids.category = category.data.category.id;
  await create('/categories', 409, { name: category.data.category.name.toUpperCase() });
  const body = { name: 'Test Product ' + suffix, description: 'Catalog test item', categoryId: ids.category,
    pricePaise: 11999, originalPricePaise: 14999, stock: 2,
    images: ['https://example.test/one.jpg', 'https://example.test/two.jpg'] };
  await create('/products', 400, { ...body, pricePaise: -1 });
  await create('/products', 400, { ...body, pricePaise: 12.4 });
  await create('/products', 400, { ...body, stock: -1 });
  await create('/products', 400, { ...body, images: ['javascript:alert(1)'] });
  const created = await create('/products', 201, body);
  ids.product = created.data.product.id;
  const view = (await request('/products/' + ids.product, 200)).data.product;
  assert.equal(view.pricePaise, 11999);
  assert.deepEqual(view.images, body.images);
  const filtered = await request('/admin/products?q=' + suffix + '&category=' + ids.category + '&status=low', 200, { cookie: admin });
  assert.deepEqual(filtered.data.products.map(product => product.id), [ids.product]);
  const counts = (await request('/admin/categories', 200, { cookie: admin })).data.categories.find(category => category.id === ids.category);
  assert.equal(counts.productCount, 1);
  assert.equal(counts.activeProductCount, 1);
  await remove('/categories/' + ids.category, 409);
  await patch('/products/' + ids.product, 200, { name: 'Updated ' + suffix, pricePaise: 12999, images: ['https://example.test/new.jpg'] });
  assert.equal((await request('/products/' + ids.product, 200)).data.product.image, 'https://example.test/new.jpg');
  await patch('/categories/' + ids.category, 200, { name: 'Renamed ' + suffix, description: 'Updated description', active: false });
  await request('/products/' + ids.product, 404);
  assert.ok(!(await request('/categories', 200)).data.categories.some(entry => entry.id === ids.category));
  await patch('/categories/' + ids.category, 200, { active: true });
  const hit = (await request('/products?category=' + ids.category + '&q=' + suffix, 200)).data.products[0];
  assert.equal(hit.pricePaise, 12999);
  assert.equal(hit.category, 'Renamed ' + suffix);
});

test('stock changes are atomic and audited, and archives preserve order references', async () => {
  await create('/inventory/adjustments', 400, { productId: ids.product, delta: 0, reason: 'Test validation' });
  await create('/inventory/adjustments', 409, { productId: ids.product, delta: -3, reason: 'Test validation' });
  const outcomes = await Promise.all([1, 2].map(async () => {
    const response = await fetch(base + '/admin/inventory/adjustments', { method: 'POST', headers: {
      Cookie: admin, Origin: origin, 'Content-Type': 'application/json', 'X-MultiStore-Request': '1',
    }, body: JSON.stringify({ productId: ids.product, delta: -2, reason: 'Concurrent stock test' }) });
    return response.status;
  }));
  assert.deepEqual(outcomes.sort(), [200,409]);
  const out = await request('/admin/inventory?status=out&q=' + suffix, 200, { cookie: admin });
  assert.equal(out.data.products[0].stock, 0);
  assert.ok(out.data.summary.outOfStock > 0);
  assert.equal((await request('/products/' + ids.product, 200)).data.product.stock, 0);
  await patch('/products/' + ids.product, 200, { stock: 1, stockReason: 'Audited stock edit' });
  const moves = (await request('/admin/inventory/transactions?productId=' + ids.product, 200, { cookie: admin })).data.transactions;
  assert.deepEqual(moves.map(move => move.delta), [1,-2,2]);
  assert.ok(moves.every(move => move.actorId === users[0] && move.createdAt));
  const { rows: [order] } = await pool.query(`INSERT INTO orders(user_id,order_number,subtotal_paise,delivery_paise,total_paise,shipping_snapshot)
    VALUES($1,$2,12999,0,12999,'{}') RETURNING id`, [users[1], 'phase4-' + suffix]);
  ids.order = order.id;
  await pool.query('INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price_paise) VALUES($1,$2,$3,1,12999)',
    [ids.order, ids.product, 'Snapshot']);
  await remove('/products/' + ids.product, 204);
  await request('/products/' + ids.product, 404);
  await remove('/categories/' + ids.category, 204);
  const joined = await pool.query('SELECT p.active FROM order_items i JOIN products p ON p.id=i.product_id WHERE i.order_id=$1', [ids.order]);
  assert.deepEqual(joined.rows, [{ active: false }]);
  await patch('/products/' + ids.product, 409, { active: true });
});
