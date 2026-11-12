import { ACK_STATUS, CHAT_EVENTS, REJECTION_REASONS } from '../../shared/protocol.js';
import { rejection, toReply } from './acknowledgement.js';
import { SocketController } from './socket-controller.js';

/**
 * Atiende el envío de mensajes de texto.
 * Orden de validación: entró al chat → anti-spam → datos válidos → guardar → repartir.
 * Nada se reparte si no se guardó primero.
 */
export class MessagingController extends SocketController {
  #room;
  #messageFactory;
  #repository;
  #createRateLimiter;
  #eventGuard;
  #metrics;

  /**
   * @param {{
   *   room: import('./chat-room.js').ChatRoom,
   *   messageFactory: import('../domain/message-factory.js').MessageFactory,
   *   repository: { save: (message: object, clientMessageId: string) => boolean },
   *   createRateLimiter: () => import('../security/rate-limiter.js').RateLimiter,
   *   eventGuard: import('./socket-event-guard.js').SocketEventGuard,
   *   metrics: import('../observability/chat-metrics.js').ChatMetrics,
   * }} dependencies
   */
  constructor({ room, messageFactory, repository, createRateLimiter, eventGuard, metrics }) {
    super();
    this.#room = room;
    this.#messageFactory = messageFactory;
    this.#repository = repository;
    this.#createRateLimiter = createRateLimiter;
    this.#eventGuard = eventGuard;
    this.#metrics = metrics;
  }

  register(socket, session) {
    const rateLimiter = this.#createRateLimiter();
    this.#eventGuard.on(socket, CHAT_EVENTS.message, (request, acknowledge) => {
      this.#handleMessage(session, rateLimiter, request, toReply(acknowledge));
    });
  }

  #handleMessage(session, rateLimiter, request, reply) {
    if (!session.hasJoined) {
      this.#reject(reply, REJECTION_REASONS.notJoined);
      return;
    }
    if (!rateLimiter.tryConsume()) {
      this.#reject(reply, REJECTION_REASONS.rateLimited);
      return;
    }
    const draft = this.#messageFactory.create(session, request);
    if (draft === null) {
      this.#reject(reply, REJECTION_REASONS.invalid);
      return;
    }
    if (!this.#repository.save(draft.message, draft.clientMessageId)) {
      this.#metrics.increment('messages_duplicate_total');
      reply({ status: ACK_STATUS.duplicate });
      return;
    }
    this.#metrics.increment('messages_accepted_total');
    this.#room.broadcast(CHAT_EVENTS.message, draft.message);
    reply({ status: ACK_STATUS.accepted, id: draft.message.id });
  }

  #reject(reply, reason) {
    this.#metrics.increment('messages_rejected_total', { reason });
    reply(rejection(reason));
  }
}
