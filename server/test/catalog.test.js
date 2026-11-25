import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { initialProducts } from '../../src/data/mockData.js';

const origin = 'http://localhost:5173';
const pool = createPool(readConfig().databaseUrl);
let server;
let base;

before(async () => {
  server = createApp({ pool, origins: [origin] }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port + '/api';
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await pool.end();
});

async function api(path, status = 200, options) {
  const response = await fetch(base + path, options);
  assert.equal(response.status, status);
  return { response, data: await response.json() };
}

test('PostgreSQL has all foundation tables and the seeded catalog', async () => {
  const required = ['users', 'categories', 'products', 'product_images', 'addresses', 'cart_items',
    'wishlist_items', 'orders', 'order_items', 'payments', 'reviews', 'inventory_transactions', 'sessions'];
  const { rows } = await pool.query('SELECT name, to_regclass(name) IS NOT NULL AS exists FROM unnest($1::text[]) AS name', [required]);
  assert.equal(rows.length, required.length);
  assert.ok(rows.every(row => row.exists));
  const counts = await pool.query(`SELECT
    (SELECT count(*)::int FROM products) AS products,
    (SELECT count(*)::int FROM categories) AS categories,
    (SELECT count(*)::int FROM product_images) AS images`);
  assert.deepEqual(counts.rows[0], { products: 475, categories: 19, images: 475 });
  const catalog = await pool.query(`SELECT p.id, p.name, p.description, p.price_paise, c.name AS category, i.url
    FROM products p JOIN categories c ON c.id = p.category_id
    JOIN product_images i ON i.product_id = p.id AND i.position = 0 ORDER BY p.display_order`);
  assert.deepEqual(catalog.rows, initialProducts.map(product => ({
    id: product.id, name: product.name, description: product.description, price_paise: product.price * 100,
    category: product.category, url: product.image,
  })));
});

test('health, security headers and CORS', async () => {
  const { response, data } = await api('/health', 200, { headers: { Origin: origin } });
  assert.deepEqual(data, { status: 'ok', database: 'ready' });
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(response.headers.get('x-request-id'));
  assert.equal(response.headers.get('x-powered-by'), null);
  const blocked = await api('/health', 403, { headers: { Origin: 'https://unlisted.example' } });
  assert.equal(blocked.data.error.code, 'ORIGIN_NOT_ALLOWED');
});

test('product list and detail preserve the original ID, integer price and image', async () => {
  const first = (await api('/products?limit=1')).data;
  assert.equal(first.nextOffset, 1);
  assert.equal(first.products[0].id, '1');
  const next = (await api('/products?limit=1&offset=1')).data;
  assert.equal(next.products[0].id, '2');
  const { product } = (await api('/products/1')).data;
  assert.deepEqual(product, first.products[0]);
  assert.equal(product.pricePaise, 1686300);
  assert.equal(product.originalPricePaise, 2162000);
  assert.match(product.image, /^https:\/\//);
  assert.equal(product.category, 'Electronics');
});

test('categories, literal search and combined category filter', async () => {
  const { categories } = (await api('/categories')).data;
  assert.equal(categories.length, 19);
  assert.ok(categories.some(category => category.name === 'Home & Furniture'));
  const bySlug = (await api('/products?category=home-furniture')).data.products;
  const byName = (await api('/products?category=Home%20%26%20Furniture')).data.products;
  assert.equal(bySlug.length, 25);
  assert.deepEqual(bySlug, byName);
  const hits = (await api('/products?category=electronics&q=sAmSuNg')).data.products;
  assert.ok(hits.length > 0);
  assert.ok(hits.every(product => product.category === 'Electronics' && product.brand === 'Samsung'));
  assert.deepEqual((await api('/products?q=%25')).data.products, []);
});

test('invalid parameters and missing resources return structured errors', async () => {
  for (const [path, status, code] of [
    ['/products?limit=101', 400, 'INVALID_QUERY'],
    ['/products?q=one&q=two', 400, 'INVALID_QUERY'],
    ['/products/invalid%20id', 400, 'INVALID_PRODUCT_ID'],
    ['/products/not-present', 404, 'PRODUCT_NOT_FOUND'],
    ['/unknown', 404, 'NOT_FOUND'],
  ]) {
    const { response, data } = await api(path, status);
    assert.equal(data.error.code, code);
    assert.equal(data.error.requestId, response.headers.get('x-request-id'));
  }
});

test('database failure returns a redacted health error', async () => {
  const offline = createApp({
    origins: [],
    pool: { query: async () => { throw Object.assign(new Error('internal database detail'), { code: 'ECONNREFUSED' }); } },
  }).listen(0, '127.0.0.1');
  await once(offline, 'listening');
  try {
    const response = await fetch('http://127.0.0.1:' + offline.address().port + '/api/health');
    assert.equal(response.status, 503);
    const { error } = await response.json();
    assert.equal(error.code, 'DATABASE_UNAVAILABLE');
    assert.doesNotMatch(error.message, /internal database detail/);
  } finally {
    await new Promise(resolve => offline.close(resolve));
  }
});
