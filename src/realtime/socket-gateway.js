import { UserSession } from './user-session.js';

/**
 * Crea una sesión por conexión y la entrega a todos los controladores.
 */
export class SocketGateway {
  #controllers;
  #logger;
  #metrics;

  /**
   * @param {{
   *   controllers: import('./socket-controller.js').SocketController[],
   *   logger: import('../observability/json-logger.js').JsonLogger,
   *   metrics: import('../observability/chat-metrics.js').ChatMetrics,
   * }} dependencies
   */
  constructor({ controllers, logger, metrics }) {
    this.#controllers = [...controllers];
    this.#logger = logger;
    this.#metrics = metrics;
  }

  /**
   * @param {import('socket.io').Server} io
   */
  attach(io) {
    io.on('connection', (socket) => {
      const session = new UserSession(socket.id);
      this.#metrics.increment('connections_total');
      this.#logger.info('socket_connected', { connectionId: socket.id });
      socket.on('disconnect', (reason) => {
        this.#logger.info('socket_disconnected', { connectionId: socket.id, reason });
      });
      for (const controller of this.#controllers) {
        controller.register(socket, session);
      }
    });
  }
}
