import express from 'express';
import helmet from 'helmet';

/**
 * Crea la aplicación web: archivos estáticos, cabeceras de seguridad y rutas de apoyo.
 * @param {{ publicDir: string, clientLimits: object }} options
 * @returns {import('express').Express}
 */
export function createHttpApp({ publicDir, clientLimits }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.static(publicDir));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/config', (_req, res) => {
    res.json(clientLimits);
  });

  return app;
}
