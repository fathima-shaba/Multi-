import { readConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { hashPassword } from '../src/auth/password.js';
import { email, password, text } from '../src/auth/validation.js';

const pool = createPool(readConfig().databaseUrl);
try {
  const address = email(process.env.MULTISTORE_ADMIN_EMAIL);
  const name = text(process.env.MULTISTORE_ADMIN_NAME ?? 'Administrator', 'Name', 2, 100);
  const secret = password(process.env.MULTISTORE_ADMIN_PASSWORD);
  delete process.env.MULTISTORE_ADMIN_PASSWORD;
  const result = await pool.query(`INSERT INTO users(name, email, password_hash, role)
    VALUES ($1,$2,$3,'admin') ON CONFLICT (email) DO NOTHING`, [name, address, await hashPassword(secret)]);
  if (!result.rowCount) throw new Error('An account already uses this email. No account was changed.');
  console.log('Administrator account created.');
} catch (error) {
  console.error('Administrator setup failed:', error.code ?? error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
