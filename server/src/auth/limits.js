import { HttpError } from '../http.js';
import { fingerprint } from './sessions.js';

export function authLimits(pool, limit = 10) {
  const windowSeconds = 15 * 60;
  let nextCleanup = 0;
  async function consume(operation, identity, maximum) {
    if (Date.now() >= nextCleanup) {
      nextCleanup = Date.now() + windowSeconds * 1000;
      await pool.query('DELETE FROM auth_attempts WHERE expires_at <= now()');
      await pool.query('DELETE FROM sessions WHERE expires_at <= now()');
    }
    const bucket = fingerprint(operation + ':' + identity);
    const { rows: [row] } = await pool.query(`INSERT INTO auth_attempts(bucket, attempts, expires_at)
      VALUES ($1, 1, now() + $2::int * interval '1 second')
      ON CONFLICT (bucket) DO UPDATE SET
        attempts = CASE WHEN auth_attempts.expires_at <= now() THEN 1
          ELSE LEAST(auth_attempts.attempts + 1, $3::int + 1) END,
        expires_at = CASE WHEN auth_attempts.expires_at <= now() THEN EXCLUDED.expires_at ELSE auth_attempts.expires_at END
      RETURNING attempts`, [bucket, windowSeconds, maximum]);
    if (row.attempts > maximum) throw new HttpError(429, 'AUTH_RATE_LIMIT', 'Too many attempts. Try again in a few minutes.');
  }
  return {
    registration: request => consume('register-ip', request.ip, limit),
    loginIp: request => consume('login-ip', request.ip, limit * 3),
    loginEmail: address => consume('login-email', address, limit),
    sensitive: userId => consume('verify-account', userId, limit),
  };
}
