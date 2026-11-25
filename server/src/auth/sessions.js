import { createHash, randomBytes } from 'node:crypto';
import { HttpError } from '../http.js';

export const publicUserColumns = 'id, name, email, phone, role';
export const fingerprint = value => createHash('sha256').update(value).digest('hex');

export function sessions(pool, { secure = false, ttlSeconds = 8 * 3600 } = {}) {
  const cookieName = secure ? '__Host-multistore_session' : 'multistore_session';
  const settings = { httpOnly: true, secure, sameSite: 'lax', path: '/' };
  function readDigest(request) {
    const matches = (request.get('cookie') ?? '').split(';').map(part => part.trim())
      .filter(part => part.startsWith(cookieName + '='));
    if (matches.length !== 1) return null;
    const token = matches[0].slice(cookieName.length + 1);
    return /^[A-Za-z0-9_-]{43}$/.test(token) ? fingerprint(token) : null;
  }
  async function issue(client, userId) {
    const token = randomBytes(32).toString('base64url');
    await client.query(`INSERT INTO sessions(token_digest, user_id, expires_at)
      VALUES ($1, $2, now() + $3::int * interval '1 second')`, [fingerprint(token), userId, ttlSeconds]);
    return token;
  }
  async function revoke(client, digest) {
    if (digest) await client.query('UPDATE sessions SET revoked_at = now() WHERE token_digest = $1 AND revoked_at IS NULL', [digest]);
  }
  async function requireUser(request, response, next) {
    const digest = readDigest(request);
    if (!digest) throw new HttpError(401, 'SIGN_IN_REQUIRED', 'Sign in to continue.');
    const { rows } = await pool.query(`SELECT u.id, u.name, u.email, u.phone, u.role
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_digest = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.active`, [digest]);
    if (!rows.length) throw new HttpError(401, 'SIGN_IN_REQUIRED', 'Sign in to continue.');
    response.locals.user = rows[0];
    response.locals.sessionDigest = digest;
    next();
  }
  function requireAdmin(_request, response, next) {
    if (response.locals.user.role !== 'admin') throw new HttpError(403, 'ADMIN_REQUIRED', 'Administrator access is required.');
    next();
  }
  return {
    readDigest, issue, revoke, requireUser, requireAdmin,
    setCookie: (response, token) => response.cookie(cookieName, token, { ...settings, maxAge: ttlSeconds * 1000 }),
    clearCookie: response => response.clearCookie(cookieName, settings),
  };
}
