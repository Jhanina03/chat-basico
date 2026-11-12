const CLIENT_ERROR_MIN = 400;
const SERVER_ERROR_MIN = 500;

function clientErrorStatus(error) {
  const status = error?.status ?? error?.statusCode;
  return Number.isInteger(status) && status >= CLIENT_ERROR_MIN && status < SERVER_ERROR_MIN ? status : null;
}

/**
 * Responde 404 en JSON para rutas que no existen.
 * @returns {import('express').RequestHandler}
 */
export function createNotFoundHandler() {
  return (_req, res) => {
    res.status(404).json({ error: 'No encontrado', requestId: res.locals.requestId });
  };
}

/**
 * Último manejador de errores: nunca muestra detalles internos (stack, rutas) al usuario.
 * Los errores 4xx se informan como solicitud inválida; el resto como error interno.
 * @param {import('../observability/json-logger.js').JsonLogger} logger
 * @param {import('../observability/chat-metrics.js').ChatMetrics} metrics
 * @returns {import('express').ErrorRequestHandler}
 */
export function createErrorHandler(logger, metrics) {
  return (error, req, res, next) => {
    const requestId = res.locals.requestId;
    const status = clientErrorStatus(error) ?? SERVER_ERROR_MIN;
    if (status >= SERVER_ERROR_MIN) {
      metrics.increment('errors_total', { source: 'http' });
      logger.error('http_request_failed', { requestId, path: req.path, error });
    } else {
      logger.warn('http_request_rejected', { requestId, path: req.path, status });
    }
    if (res.headersSent) {
      next(error);
      return;
    }
    const message = status >= SERVER_ERROR_MIN ? 'Error interno del servidor' : 'Solicitud inválida';
    res.status(status).json({ error: message, requestId });
  };
}
