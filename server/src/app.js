import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { join } from 'node:path';
import { catalogRoutes } from './catalog.js';
import { accountRoutes } from './auth/routes.js';
import { HttpError, errorHandler, requestLog } from './http.js';
import { webhookHandlers } from './payments/routes.js';
import { publicReviewRoutes } from './reviews/routes.js';

export function createApp({ pool, origins, sessionOptions, trustProxy = 0, gateway = null, frontendDir }) {
  const app = express();
  app.set('trust proxy', trustProxy);
  app.disable('x-powered-by');
  app.use(requestLog);
  app.use(helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: { directives: {
      scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      frameSrc: ['https://*.razorpay.com'],
      connectSrc: ["'self'", 'https://*.razorpay.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    } },
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, false);
      if (!origins.includes(origin)) return callback(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed.'));
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-MultiStore-Request'],
    exposedHeaders: ['X-Request-Id'],
  }));
  app.post('/api/payments/razorpay/webhook', ...webhookHandlers(pool,gateway));
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', async (_request, response) => {
    try {
      const { rows } = await pool.query(`SELECT EXISTS (SELECT 1 FROM schema_migrations
        WHERE filename = '007_admin_reporting.sql') AS ready`);
      if (!rows[0].ready) throw new Error('Required migrations are missing');
      response.json({ status: 'ok', database: 'ready' });
    } catch (error) {
      console.error('Database health check failed', error.code ?? error.name);
      throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The catalog database is unavailable.');
    }
  });
  app.use('/api', accountRoutes(pool, origins, sessionOptions,gateway));
  app.use('/api', publicReviewRoutes(pool));
  app.use('/api', catalogRoutes(pool));
  app.use('/api', (_request, _response, next) => next(new HttpError(404, 'NOT_FOUND', 'API route not found.')));
  if (frontendDir) {
    app.use('/assets', express.static(join(frontendDir, 'assets'), { immutable: true, maxAge: '1y', index: false }));
    app.use(express.static(frontendDir, { index: false }));
    app.get(['/', '/shop', '/product/:id', '/cart', '/checkout', '/wishlist', '/profile', '/orders',
      '/orders/:orderId', '/login', '/register', '/admin', '/admin/:section'], (_request, response) => {
      response.set('Cache-Control', 'no-cache').sendFile(join(frontendDir, 'index.html'));
    });
  }
  app.use((_request, _response, next) => next(new HttpError(404, 'NOT_FOUND', 'API route not found.')));
  app.use(errorHandler);
  return app;
}
