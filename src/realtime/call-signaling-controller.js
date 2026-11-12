import { CHAT_EVENTS } from '../../shared/protocol.js';
import { SocketController } from './socket-controller.js';

/**
 * Reenvía las señales de videollamada (WebRTC) entre dos usuarios conectados.
 * El video no pasa por el servidor: solo se intercambian los datos para conectarse.
 */
export class CallSignalingController extends SocketController {
  #room;
  #validator;
  #createRateLimiter;
  #eventGuard;
  #metrics;

  /**
   * @param {{
   *   room: import('./chat-room.js').ChatRoom,
   *   validator: import('../domain/call-signal-validator.js').CallSignalValidator,
   *   createRateLimiter: () => import('../security/rate-limiter.js').RateLimiter,
   *   eventGuard: import('./socket-event-guard.js').SocketEventGuard,
   *   metrics: import('../observability/chat-metrics.js').ChatMetrics,
   * }} dependencies
   */
  constructor({ room, validator, createRateLimiter, eventGuard, metrics }) {
    super();
    this.#room = room;
    this.#validator = validator;
    this.#createRateLimiter = createRateLimiter;
    this.#eventGuard = eventGuard;
    this.#metrics = metrics;
  }

  register(socket, session) {
    const rateLimiter = this.#createRateLimiter();
    for (const event of this.#validator.events) {
      this.#eventGuard.on(socket, event, (signal) => this.#forward({ socket, session, rateLimiter, event, signal }));
    }
  }

  #forward({ socket, session, rateLimiter, event, signal }) {
    const targetId = signal?.to;
    if (!session.hasJoined || !this.#canReach(session, targetId)) {
      this.#rejectSignal(event, 'unreachable');
      return;
    }
    if (!rateLimiter.tryConsume()) {
      this.#rejectSignal(event, 'rate-limited');
      socket.emit(CHAT_EVENTS.rateLimited);
      return;
    }
    const payload = this.#validator.parse(event, signal);
    if (payload === null) {
      this.#rejectSignal(event, 'invalid');
      return;
    }
    this.#metrics.increment('signals_forwarded_total', { event });
    this.#room.sendTo(targetId, event, { ...payload, from: session.id, fromName: session.name });
  }

  #canReach(session, targetId) {
    return typeof targetId === 'string' && targetId !== session.id && this.#room.hasMember(targetId);
  }

  #rejectSignal(event, reason) {
    this.#metrics.increment('signals_rejected_total', { event, reason });
  }
}
