import { ACK_STATUS, CHAT_EVENTS, REJECTION_REASONS } from '../../shared/protocol.js';
import { rejection, toReply } from './acknowledgement.js';
import { SocketController } from './socket-controller.js';

/**
 * Atiende la presencia: entrar al chat (con nombre único) y salir.
 */
export class PresenceController extends SocketController {
  #room;
  #namePolicy;
  #notices;
  #history;
  #eventGuard;
  #metrics;

  /**
   * @param {{
   *   room: import('./chat-room.js').ChatRoom,
   *   namePolicy: import('../domain/display-name-policy.js').DisplayNamePolicy,
   *   notices: import('../domain/chat-notices.js').ChatNotices,
   *   history: { listRecent: () => object[] },
   *   eventGuard: import('./socket-event-guard.js').SocketEventGuard,
   *   metrics: import('../observability/chat-metrics.js').ChatMetrics,
   * }} dependencies
   */
  constructor({ room, namePolicy, notices, history, eventGuard, metrics }) {
    super();
    this.#room = room;
    this.#namePolicy = namePolicy;
    this.#notices = notices;
    this.#history = history;
    this.#eventGuard = eventGuard;
    this.#metrics = metrics;
  }

  register(socket, session) {
    this.#eventGuard.on(socket, CHAT_EVENTS.join, (rawName, acknowledge) => {
      this.#handleJoin(socket, session, rawName, toReply(acknowledge));
    });
    this.#eventGuard.on(socket, 'disconnect', () => this.#handleDisconnect(socket, session));
  }

  #handleJoin(socket, session, rawName, reply) {
    if (session.hasJoined) {
      this.#rejectJoin(reply, REJECTION_REASONS.alreadyJoined);
      return;
    }
    if (this.#room.isFull()) {
      this.#rejectJoin(reply, REJECTION_REASONS.chatFull);
      return;
    }
    session.join(this.#namePolicy.normalizeUnique(rawName, (candidate) => this.#room.isNameTaken(candidate)));
    this.#room.admit(socket, session);
    this.#metrics.increment('joins_total');
    reply({ status: ACK_STATUS.joined, id: session.id, name: session.name, history: this.#history.listRecent() });
    this.#room.broadcastFrom(socket, CHAT_EVENTS.notice, this.#notices.joined(session.name));
    this.#room.broadcastUsers();
  }

  #handleDisconnect(socket, session) {
    if (!session.hasJoined) {
      return;
    }
    this.#room.remove(session);
    this.#room.broadcastFrom(socket, CHAT_EVENTS.notice, this.#notices.left(session.name));
    this.#room.broadcastUsers();
  }

  #rejectJoin(reply, reason) {
    this.#metrics.increment('joins_rejected_total', { reason });
    reply(rejection(reason));
  }
}
