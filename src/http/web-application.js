import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { createErrorHandler, createNotFoundHandler } from './http-error-handlers.js';
import { createRequestContext } from './request-context.js';

/** Las cabeceras de caché las define la política de seguridad (no-store), no express.static. */
const STATIC_OPTIONS = Object.freeze({ cacheControl: false, index: 'index.html' });

/**
 * Crea la aplicación web: seguridad, archivos estáticos y rutas de apoyo.
 * @param {{
 *   assets: { publicDir: string, sharedDir: string, socketClientFile: string },
 *   clientConfig: object,
 *   observability: {
 *     logger: import('../observability/json-logger.js').JsonLogger,
 *     metrics: import('../observability/chat-metrics.js').ChatMetrics,
 *     idGenerator: { next: () => string },
 *   },
 *   security: {
 *     securityHeaders: import('express').RequestHandler,
 *     metricsAccess: import('../security/bearer-token-verifier.js').BearerTokenVerifier,
 *     httpRate: { limit: number, intervalMs: number },
 *     trustProxyHops: number,
 *   },
 * }} options
 * @returns {import('express').Express}
 */
export function createWebApplication({ assets, clientConfig, observability, security }) {
  const { logger, metrics } = observability;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', security.trustProxyHops);

  app.use(createRequestContext(observability));
  app.use(security.securityHeaders);
  app.use(
    rateLimit({
      windowMs: security.httpRate.intervalMs,
      limit: security.httpRate.limit,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({ error: 'Demasiadas solicitudes', requestId: res.locals.requestId });
      },
    }),
  );

  app.use(express.static(assets.publicDir, STATIC_OPTIONS));
  app.use('/shared', express.static(assets.sharedDir, STATIC_OPTIONS));
  app.get('/vendor/socket.io.min.js', (_req, res, next) => {
    res.sendFile(assets.socketClientFile, { cacheControl: false }, next);
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/config', (_req, res) => {
    res.json(clientConfig);
  });

  app.get('/metrics', (req, res, next) => {
    if (!security.metricsAccess.isEnabled) {
      next();
      return;
    }
    if (!security.metricsAccess.isAuthorized(req.get('authorization'))) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: 'No autorizado', requestId: res.locals.requestId });
      return;
    }
    res.type('text/plain; version=0.0.4').send(metrics.toPrometheus());
  });

  app.use(createNotFoundHandler());
  app.use(createErrorHandler(logger, metrics));
  return app;
}
