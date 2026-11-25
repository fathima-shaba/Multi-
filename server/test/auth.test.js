import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { hashPassword } from '../src/auth/password.js';

const origin = 'http://localhost:5173';
const pool = createPool(readConfig().databaseUrl);
const fixtures = [];
const secret = () => randomBytes(20).toString('base64url');
const account = (name = 'Test Shopper') => ({ name, email: randomUUID() + '@example.test', phone: '9123456780', password: secret() });
let server;
let base;
let primary;
let second;
let firstCookie;
let secondCookie;
let addressId;

before(async () => {
  server = createApp({ pool, origins: [origin], sessionOptions: { secure: true, rateLimit: 6 } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port + '/api';
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  try {
    if (fixtures.length) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [fixtures]);
  } finally {
    await pool.end();
  }
});

async function request(path, expected, { method = 'GET', body, cookie, headers = {}, csrf = true } = {}) {
  const options = {
    method,
    headers: {
      ...(method === 'GET' || !csrf ? {} : { Origin: origin, 'X-MultiStore-Request': '1' }),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body && JSON.stringify(body),
  };
  const response = await fetch(base + path, options);
  const data = response.status === 204 ? null : await response.json();
  assert.equal(response.status, expected, data?.error?.code);
  const setCookie = response.headers.get('set-cookie');
  return { data, response, setCookie, cookie: setCookie?.split(';')[0] };
}

const post = (path, status, body, cookie) => request(path, status, { method: 'POST', body, cookie });
const patch = (path, status, body, cookie) => request(path, status, { method: 'PATCH', body, cookie });
const login = (email, password, status, cookie) => post('/auth/login', status, { email, password }, cookie);
const assertPublicUser = user => assert.deepEqual(Object.keys(user).sort(), ['email', 'id', 'name', 'phone', 'role']);

test('registration validation, duplicate rejection, hash-only storage, protected and admin routes', async () => {
  await request('/auth/me', 401);
  await request('/admin/access', 401);
  await request('/addresses', 401);
  primary = account();
  await post('/auth/register', 400, { ...primary, phone: 'invalid' });
  await post('/auth/register', 400, { ...primary, email: 'invalid' });
  await post('/auth/register', 400, { ...primary, role: 'admin' });
  const created = await post('/auth/register', 201, primary);
  fixtures.push(created.data.user.id);
  firstCookie = created.cookie;
  assertPublicUser(created.data.user);
  assert.equal(created.data.user.role, 'customer');
  assert.match(created.setCookie, /^__Host-multistore_session=/);
  assert.match(created.setCookie, /HttpOnly/);
  assert.match(created.setCookie, /Secure/);
  assert.match(created.setCookie, /SameSite=Lax/);
  const token = firstCookie.split('=')[1];
  const digest = createHash('sha256').update(token).digest('hex');
  const { rows: [row] } = await pool.query(`SELECT password_hash, token_digest FROM users
    JOIN sessions ON sessions.user_id = users.id WHERE users.id = $1`, [created.data.user.id]);
  assert.match(row.password_hash, /^\$argon2id\$/);
  assert.notEqual(row.password_hash, primary.password);
  assert.equal(row.token_digest, digest);
  assertPublicUser((await request('/auth/me', 200, { cookie: firstCookie })).data.user);
  await request('/admin/access', 403, { cookie: firstCookie });
  await post('/auth/register', 409, { ...primary, email: primary.email.toUpperCase() });
  second = account('Second Shopper');
  const other = await post('/auth/register', 201, second);
  fixtures.push(other.data.user.id);
  secondCookie = other.cookie;
});

test('credentialed preflight, CSRF and owner-scoped address operations', async () => {
  const preflight = await request('/addresses', 204, { method: 'OPTIONS', csrf: false, headers: {
    Origin: origin, 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'x-multistore-request,content-type',
  } });
  assert.equal(preflight.response.headers.get('access-control-allow-origin'), origin);
  assert.equal(preflight.response.headers.get('access-control-allow-credentials'), 'true');
  const attempt = { recipient: 'Test Shopper', phone: '9123456780', addressLine: '12 Example Street', locality: '', city: 'Pune', state: 'Maharashtra', pincode: '411001' };
  await request('/addresses', 403, { method: 'POST', cookie: firstCookie, body: attempt, csrf: false, headers: { Origin: origin } });
  await request('/auth/logout', 403, { method: 'POST', cookie: firstCookie, csrf: false, headers: { 'X-MultiStore-Request': '1' } });
  await post('/addresses', 400, { ...attempt, pincode: '1' }, firstCookie);
  const created = await post('/addresses', 201, attempt, firstCookie);
  addressId = created.data.address.id;
  assert.equal((await request('/addresses', 200, { cookie: firstCookie })).data.addresses.length, 1);
  assert.deepEqual((await request('/addresses', 200, { cookie: secondCookie })).data.addresses, []);
  await patch('/addresses/' + addressId, 404, { city: 'Mumbai' }, secondCookie);
  await request('/addresses/' + addressId, 404, { method: 'DELETE', cookie: secondCookie });
  const updated = await patch('/addresses/' + addressId, 200, { locality: 'New Locality' }, firstCookie);
  assert.equal(updated.data.address.locality, 'New Locality');
  await request('/addresses/' + addressId, 204, { method: 'DELETE', cookie: firstCookie });
  assert.deepEqual((await request('/addresses', 200, { cookie: firstCookie })).data.addresses, []);
});

test('sign-in rotation, profile validation, password rotation, expiry and logout', async () => {
  await login(primary.email, secret(), 401);
  const signedIn = await login(primary.email, primary.password, 200, firstCookie);
  assert.notEqual(firstCookie, signedIn.cookie);
  await request('/auth/me', 401, { cookie: firstCookie });
  firstCookie = signedIn.cookie;
  await patch('/users/me', 400, { role: 'admin' }, firstCookie);
  await patch('/users/me', 400, { email: 'bad' }, firstCookie);
  await patch('/users/me', 400, { email: second.email, currentPassword: secret() }, firstCookie);
  await patch('/users/me', 409, { email: second.email, currentPassword: primary.password }, firstCookie);
  const changedEmail = randomUUID() + '@example.test';
  const updated = await patch('/users/me', 200, {
    name: 'Updated Shopper', email: changedEmail, phone: '9777777777', currentPassword: primary.password,
  }, firstCookie);
  assertPublicUser(updated.data.user);
  assert.equal(updated.data.user.name, 'Updated Shopper');
  assert.equal(updated.data.user.phone, '9777777777');
  const sibling = await login(changedEmail, primary.password, 200);
  await patch('/users/me/password', 400, { currentPassword: secret(), newPassword: secret() }, firstCookie);
  const replacement = secret();
  const changed = await patch('/users/me/password', 204, { currentPassword: primary.password, newPassword: replacement }, firstCookie);
  await request('/auth/me', 401, { cookie: firstCookie });
  await request('/auth/me', 401, { cookie: sibling.cookie });
  await request('/auth/me', 200, { cookie: changed.cookie });
  await login(changedEmail, primary.password, 401);
  const fresh = await login(changedEmail, replacement, 200);
  const loggedOut = await post('/auth/logout', 204, undefined, fresh.cookie);
  assert.match(loggedOut.setCookie, /Expires=/);
  await request('/auth/me', 401, { cookie: fresh.cookie });
  const digest = createHash('sha256').update(changed.cookie.split('=')[1]).digest('hex');
  await pool.query("UPDATE sessions SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' WHERE token_digest = $1", [digest]);
  await request('/auth/me', 401, { cookie: changed.cookie });
});

test('administrator authentication and bounded login attempts', async () => {
  const admin = account('Test Administrator');
  const result = await pool.query("INSERT INTO users(name, email, password_hash, role) VALUES ($1,$2,$3,'admin') RETURNING id",
    [admin.name, admin.email, await hashPassword(admin.password)]);
  fixtures.push(result.rows[0].id);
  const signedIn = await login(admin.email, admin.password, 200);
  assert.equal(signedIn.data.user.role, 'admin');
  assert.deepEqual((await request('/admin/access', 200, { cookie: signedIn.cookie })).data, { allowed: true });
  const unknown = randomUUID() + '@example.test';
  for (let index = 0; index < 6; index++) await login(unknown, secret(), 401);
  await login(unknown, secret(), 429);
});
