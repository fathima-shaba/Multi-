import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(argon2);
const parameters = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };
const prefix = '$argon2id$v=19$m=19456,t=2,p=1$';
const base64 = bytes => bytes.toString('base64').replace(/=+$/, '');

export async function hashPassword(password) {
  const nonce = randomBytes(16);
  const hash = await derive('argon2id', { ...parameters, nonce, message: password });
  return prefix + base64(nonce) + '$' + base64(hash);
}

export async function verifyPassword(password, encoded) {
  const [salt, digest] = encoded?.startsWith(prefix) ? encoded.slice(prefix.length).split('$') : [];
  const nonce = salt ? Buffer.from(salt, 'base64') : Buffer.alloc(16);
  const expected = digest ? Buffer.from(digest, 'base64') : Buffer.alloc(32);
  const valid = nonce.length === 16 && expected.length === 32 && Boolean(salt && digest);
  const actual = await derive('argon2id', { ...parameters, nonce: valid ? nonce : Buffer.alloc(16), message: password });
  return valid && timingSafeEqual(actual, expected);
}
