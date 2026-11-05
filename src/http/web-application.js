import express from 'express';
import helmet from 'helmet';

/** Solo esta página puede usar la cámara y el micrófono; nada puede usar ubicación ni pagos. */
const PERMISSIONS_POLICY = 'camera=(self), microphone=(self), geolocation=(), payment=()';

/**
 * Crea la aplicación web: archivos estáticos, cabeceras de seguridad y rutas de apoyo.
 * @param {{ publicDir: string, sharedDir: string, clientConfig: object }} options
 * @returns {import('express').Express}
 */
export function createWebApplication({ publicDir, sharedDir, clientConfig }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    next();
  });
  app.use(express.static(publicDir));
  app.use('/shared', express.static(sharedDir));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/config', (_req, res) => {
    res.json(clientConfig);
  });

  return app;
}
