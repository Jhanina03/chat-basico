import { CHAT_EVENTS } from '../../shared/protocol.js';
import { SocketController } from './socket-controller.js';

/**
 * Reenvía las señales de videollamada (WebRTC) entre dos usuarios conectados.
 * El video no pasa por el servidor: solo se intercambian los datos para conectarse.
 */
export class CallSignalingController extends SocketController {
  #io;
  #directory;
  #validator;
  #createRateLimiter;

  /**
   * @param {{
   *   io: import('socket.io').Server,
   *   directory: import('../domain/user-directory.js').UserDirectory,
   *   validator: import('../domain/call-signal-validator.js').CallSignalValidator,
   *   createRateLimiter: () => import('../security/rate-limiter.js').RateLimiter,
   * }} dependencies
   */
  constructor({ io, directory, validator, createRateLimiter }) {
    super();
    this.#io = io;
    this.#directory = directory;
    this.#validator = validator;
    this.#createRateLimiter = createRateLimiter;
  }

  register(socket, session) {
    const rateLimiter = this.#createRateLimiter();
    for (const event of this.#validator.events) {
      socket.on(event, (signal) => this.#forward({ socket, session, rateLimiter, event, signal }));
    }
  }

  #forward({ socket, session, rateLimiter, event, signal }) {
    const targetId = signal?.to;
    if (!session.hasJoined || !this.#canReach(session, targetId)) {
      return;
    }
    if (!rateLimiter.tryConsume()) {
      socket.emit(CHAT_EVENTS.rateLimited);
      return;
    }
    const payload = this.#validator.parse(event, signal);
    if (payload === null) {
      return;
    }
    this.#io.to(targetId).emit(event, { ...payload, from: session.id, fromName: session.name });
  }

  #canReach(session, targetId) {
    return typeof targetId === 'string' && targetId !== session.id && this.#directory.has(targetId);
  }
}
