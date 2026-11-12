import { CHAT_EVENTS, REJECTION_REASONS } from '../../shared/protocol.js';
import { rejection } from './acknowledgement.js';

/**
 * Registra eventos de Socket.IO protegidos: si un manejador falla, el error se
 * registra, se cuenta en las métricas y se avisa al usuario, sin tumbar el servidor
 * y sin mostrar detalles internos.
 */
export class SocketEventGuard {
  #logger;
  #metrics;

  /**
   * @param {{
   *   logger: import('../observability/json-logger.js').JsonLogger,
   *   metrics: import('../observability/chat-metrics.js').ChatMetrics,
   * }} dependencies
   */
  constructor({ logger, metrics }) {
    this.#logger = logger;
    this.#metrics = metrics;
  }

  /**
   * @param {import('socket.io').Socket} socket
   * @param {string} event
   * @param {(...args: unknown[]) => void} handler
   */
  on(socket, event, handler) {
    socket.on(event, (...args) => {
      try {
        handler(...args);
      } catch (error) {
        this.#handleFailure(socket, event, error, args.at(-1));
      }
    });
  }

  #handleFailure(socket, event, error, lastArgument) {
    this.#metrics.increment('errors_total', { source: 'socket' });
    this.#logger.error('socket_handler_failed', { connectionId: socket.id, socketEvent: event, error });
    socket.emit(CHAT_EVENTS.serverError);
    if (typeof lastArgument === 'function') {
      lastArgument(rejection(REJECTION_REASONS.serverError));
    }
  }
}
