import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createPool } from './db.js';
import { createRazorpayGateway } from './payments/gateway.js';
import { expireReservations } from './payments/reservations.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const { databaseUrl, host, port, origins, sessionOptions, trustProxy, frontendDir } = readConfig();
if (frontendDir && !existsSync(join(frontendDir, 'index.html'))) throw new Error('Run npm run build before serving the frontend.');
const pool = createPool(databaseUrl);
const gateway = createRazorpayGateway();
const server = createApp({ pool, origins, sessionOptions, trustProxy, gateway, frontendDir }).listen(port, host, () => {
  console.log('MultiStore API listening on http://' + host + ':' + port);
});
let sweeping = false;
const timer = setInterval(async () => {
  if (sweeping) return;
  sweeping = true;
  try { await expireReservations(pool); }
  catch (error) { console.error('Reservation sweep failed',error.code ?? error.name); }
  finally { sweeping = false; }
},30000);
timer.unref();

function shutdown() {
  clearInterval(timer);
  server.close(async () => {
    await pool.end();
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
