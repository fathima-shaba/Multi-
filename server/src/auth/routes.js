import { Router } from 'express';
import { transaction } from '../db.js';
import { HttpError } from '../http.js';
import { publicUserColumns, sessions } from './sessions.js';
import { hashPassword, verifyPassword } from './password.js';
import { authLimits } from './limits.js';
import { email, fields, invalid, password, phone, text } from './validation.js';
import { addressRoutes } from './addresses.js';
import { adminCatalogRoutes } from '../admin/catalog.js';
import { adminOrderRoutes, commerceRoutes } from '../commerce/routes.js';
import { adminPaymentRoutes, paymentRoutes } from '../payments/routes.js';
import { adminReviewRoutes, customerReviewRoutes } from '../reviews/routes.js';
import { adminBusinessRoutes } from '../admin/business.js';

const wrongLogin = () => new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
const duplicate = () => new HttpError(409, 'EMAIL_EXISTS', 'An account already uses this email.');

export function accountRoutes(pool, origins, options,gateway) {
  const router = Router();
  const session = sessions(pool, options);
  const rate = authLimits(pool, options?.rateLimit);

  router.use(['/auth', '/users', '/addresses', '/admin', '/cart', '/wishlist', '/checkout', '/orders','/payments',
    '/reviews','/products/:id/reviews','/products/:id/review-eligibility'], (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      if (!origins.includes(request.get('origin')) || request.get('X-MultiStore-Request') !== '1') {
        throw new HttpError(403, 'CSRF_REJECTED', 'The request did not originate from an approved storefront.');
      }
    }
    next();
  });

  router.post('/auth/register', async (request, response) => {
    await rate.registration(request);
    const input = fields(request.body, ['name', 'email', 'phone', 'password']);
    const values = [text(input.name, 'Name', 2, 100), email(input.email), phone(input.phone)];
    const hash = await hashPassword(password(input.password));
    const { user, token } = await transaction(pool, async client => {
      const { rows: [user] } = await client.query(`INSERT INTO users(name,email,phone,password_hash)
        VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING RETURNING ${publicUserColumns}`, [...values, hash]);
      if (!user) throw duplicate();
      await session.revoke(client, session.readDigest(request));
      return { user, token: await session.issue(client, user.id) };
    });
    session.setCookie(response, token).status(201).json({ user });
  });

  router.post('/auth/login', async (request, response) => {
    await rate.loginIp(request);
    const input = fields(request.body, ['email', 'password']);
    const address = email(input.email);
    const supplied = password(input.password, 1);
    await rate.loginEmail(address);
    const { rows: [candidate] } = await pool.query('SELECT id, password_hash FROM users WHERE email = $1 AND active', [address]);
    if (!await verifyPassword(supplied, candidate?.password_hash)) throw wrongLogin();
    const { user, token } = await transaction(pool, async client => {
      const { rows: [user] } = await client.query(`SELECT ${publicUserColumns} FROM users
        WHERE id = $1 AND email = $2 AND password_hash = $3 AND active FOR UPDATE`, [candidate.id, address, candidate.password_hash]);
      if (!user) throw wrongLogin();
      await session.revoke(client, session.readDigest(request));
      return { user, token: await session.issue(client, user.id) };
    });
    session.setCookie(response, token).json({ user });
  });

  router.post('/auth/logout', async (request, response) => {
    await session.revoke(pool, session.readDigest(request));
    session.clearCookie(response).sendStatus(204);
  });

  router.get('/auth/me', session.requireUser, (_request, response) => response.json({ user: response.locals.user }));

  router.patch('/users/me', session.requireUser, async (request, response) => {
    const input = fields(request.body, ['name', 'email', 'phone', 'currentPassword']);
    if (input.name === undefined && input.email === undefined && input.phone === undefined) invalid('Provide profile changes.');
    const current = response.locals.user;
    const name = input.name === undefined ? null : text(input.name, 'Name', 2, 100);
    const address = input.email === undefined ? null : email(input.email);
    const number = input.phone === undefined ? null : phone(input.phone);
    let expectedHash = null;
    if (address && address !== current.email) {
      await rate.sensitive(current.id);
      const { rows: [record] } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [current.id]);
      if (!await verifyPassword(password(input.currentPassword, 1), record?.password_hash)) {
        throw new HttpError(400, 'CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect.');
      }
      expectedHash = record.password_hash;
    }
    try {
      const { rows: [user] } = await pool.query(`UPDATE users SET name = COALESCE($2, name), phone = COALESCE($3, phone),
          email = COALESCE($4, email), updated_at = now()
        WHERE id = $1 AND active
          AND ($4::text IS NULL OR email = $4 OR password_hash = $5)
        RETURNING ${publicUserColumns}`, [current.id, name, number, address, expectedHash]);
      if (!user) throw new HttpError(409, 'PROFILE_CHANGED', 'Account details changed. Refresh and try again.');
      response.json({ user });
    } catch (error) {
      if (error.code === '23505') throw duplicate();
      throw error;
    }
  });

  router.patch('/users/me/password', session.requireUser, async (request, response) => {
    const input = fields(request.body, ['currentPassword', 'newPassword']);
    const existing = password(input.currentPassword, 1);
    const replacement = password(input.newPassword);
    if (existing === replacement) invalid('Choose a different new password.');
    const { id } = response.locals.user;
    await rate.sensitive(id);
    const { rows: [record] } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [id]);
    if (!await verifyPassword(existing, record?.password_hash)) {
      throw new HttpError(400, 'CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect.');
    }
    const hash = await hashPassword(replacement);
    const token = await transaction(pool, async client => {
      const update = await client.query(`UPDATE users SET password_hash = $2, updated_at = now()
        WHERE id = $1 AND password_hash = $3 AND active`, [id, hash, record.password_hash]);
      if (!update.rowCount) throw new HttpError(409, 'PASSWORD_CHANGED', 'Your password has changed. Sign in again.');
      await client.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
      return session.issue(client, id);
    });
    session.setCookie(response, token).sendStatus(204);
  });

  router.use('/addresses', session.requireUser, addressRoutes(pool));
  router.use(customerReviewRoutes(pool,session.requireUser));
  router.use(paymentRoutes(pool,gateway,session.requireUser));
  router.use(commerceRoutes(pool,session.requireUser));
  router.use('/admin', session.requireUser, session.requireAdmin);
  router.get('/admin/access', (_request, response) => response.json({ allowed: true }));
  router.use('/admin', adminCatalogRoutes(pool));
  router.use('/admin', adminOrderRoutes(pool));
  router.use('/admin', adminPaymentRoutes(pool,gateway));
  router.use('/admin', adminReviewRoutes(pool));
  router.use('/admin', adminBusinessRoutes(pool));
  return router;
}
