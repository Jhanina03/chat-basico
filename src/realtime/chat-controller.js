import { CHAT_EVENTS } from '../../shared/protocol.js';
import { CHAT_ROOM } from '../config/chat-settings.js';
import { SocketController } from './socket-controller.js';

/**
 * Atiende los eventos del chat de texto: entrar, enviar mensajes y salir.
 */
export class ChatController extends SocketController {
  #io;
  #history;
  #directory;
  #messageFactory;
  #namePolicy;
  #createRateLimiter;

  /**
   * @param {{
   *   io: import('socket.io').Server,
   *   history: import('../domain/message-history.js').MessageHistory,
   *   directory: import('../domain/user-directory.js').UserDirectory,
   *   messageFactory: import('../domain/message-factory.js').MessageFactory,
   *   namePolicy: import('../domain/display-name-policy.js').DisplayNamePolicy,
   *   createRateLimiter: () => import('../security/rate-limiter.js').RateLimiter,
   * }} dependencies
   */
  constructor({ io, history, directory, messageFactory, namePolicy, createRateLimiter }) {
    super();
    this.#io = io;
    this.#history = history;
    this.#directory = directory;
    this.#messageFactory = messageFactory;
    this.#namePolicy = namePolicy;
    this.#createRateLimiter = createRateLimiter;
  }

  register(socket, session) {
    const rateLimiter = this.#createRateLimiter();
    socket.on(CHAT_EVENTS.join, (rawName) => this.#handleJoin(socket, session, rawName));
    socket.on(CHAT_EVENTS.message, (rawText) => this.#handleMessage(socket, session, rateLimiter, rawText));
    socket.on('disconnect', () => this.#handleDisconnect(socket, session));
  }

  #handleJoin(socket, session, rawName) {
    if (!session.join(this.#namePolicy.normalize(rawName))) {
      return;
    }
    this.#directory.add(session);
    socket.join(CHAT_ROOM);
    socket.emit(CHAT_EVENTS.welcome, { id: session.id, name: session.name });
    socket.emit(CHAT_EVENTS.history, this.#history.list());
    socket.to(CHAT_ROOM).emit(CHAT_EVENTS.notice, `${session.name} entró al chat`);
    this.#broadcastUsers();
  }

  #handleMessage(socket, session, rateLimiter, rawText) {
    if (!session.hasJoined) {
      return;
    }
    if (!rateLimiter.tryConsume()) {
      socket.emit(CHAT_EVENTS.rateLimited);
      return;
    }
    const message = this.#messageFactory.create(session, rawText);
    if (message === null) {
      return;
    }
    this.#history.add(message);
    this.#io.to(CHAT_ROOM).emit(CHAT_EVENTS.message, message);
  }

  #handleDisconnect(socket, session) {
    if (!session.hasJoined) {
      return;
    }
    this.#directory.remove(session.id);
    socket.to(CHAT_ROOM).emit(CHAT_EVENTS.notice, `${session.name} salió del chat`);
    this.#broadcastUsers();
  }

  #broadcastUsers() {
    this.#io.to(CHAT_ROOM).emit(CHAT_EVENTS.users, this.#directory.list());
  }
}
