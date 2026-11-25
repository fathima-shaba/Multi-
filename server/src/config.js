import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

function loadLocalEnvironment() {
  try {
    loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

loadLocalEnvironment();

export function readConfig() {
  const { DATABASE_URL, HOST = '127.0.0.1', PORT = '3001', NODE_ENV,
    FRONTEND_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173',
    COOKIE_SECURE = NODE_ENV === 'production' ? 'true' : 'false', TRUST_PROXY_HOPS = '0',
    SERVE_FRONTEND = NODE_ENV === 'production' ? 'true' : 'false' } = process.env;
  if (!/^postgres(?:ql)?:\/\//.test(DATABASE_URL ?? '')) {
    throw new Error('Set DATABASE_URL to a PostgreSQL URL in server/.env or the environment.');
  }
  const port = Number(PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  if (!['true', 'false'].includes(COOKIE_SECURE) || (NODE_ENV === 'production' && COOKIE_SECURE !== 'true')) {
    throw new Error('COOKIE_SECURE must be true in production.');
  }
  if (!/^[0-5]$/.test(TRUST_PROXY_HOPS)) throw new Error('TRUST_PROXY_HOPS must be between 0 and 5.');
  const origins = FRONTEND_ORIGINS.split(',').map(value => value.trim()).filter(Boolean);
  for (const origin of origins) {
    const url = URL.parse(origin);
    if (!url || url.origin !== origin || !['http:', 'https:'].includes(url.protocol) ||
      (NODE_ENV === 'production' && url.protocol !== 'https:')) {
      throw new Error('FRONTEND_ORIGINS must contain exact HTTP(S) origins, using HTTPS in production.');
    }
  }
  if (!origins.length) throw new Error('Configure at least one FRONTEND_ORIGINS entry.');
  if (!['true', 'false'].includes(SERVE_FRONTEND)) throw new Error('SERVE_FRONTEND must be true or false.');
  return { databaseUrl: DATABASE_URL, host: HOST, port, origins,
    sessionOptions: { secure: COOKIE_SECURE === 'true' }, trustProxy: Number(TRUST_PROXY_HOPS),
    frontendDir: SERVE_FRONTEND === 'true' ? fileURLToPath(new URL('../../dist/', import.meta.url)) : undefined };
}
