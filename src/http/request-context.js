import { performance } from 'node:perf_hooks';

/** Solo se acepta el identificador que envía el cliente si tiene un formato seguro. */
const REQUEST_ID_PATTERN = /^[\w-]{8,64}$/;

/**
 * Da a cada petición un identificador de correlación (cabecera X-Request-Id),
 * y registra en el log el resultado y la duración de la petición.
 * @param {{
 *   idGenerator: { next: () => string },
 *   logger: import('../observability/json-logger.js').JsonLogger,
 *   metrics: import('../observability/chat-metrics.js').ChatMetrics,
 * }} dependencies
 * @returns {import('express').RequestHandler}
 */
export function createRequestContext({ idGenerator, logger, metrics }) {
  return (req, res, next) => {
    const incomingId = req.get('x-request-id');
    const requestId = incomingId && REQUEST_ID_PATTERN.test(incomingId) ? incomingId : idGenerator.next();
    const startedAt = performance.now();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.on('finish', () => {
      metrics.increment('http_requests_total', { status: String(res.statusCode) });
      logger.debug('http_request', {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      });
    });
    next();
  };
}
