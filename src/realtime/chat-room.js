import { CHAT_EVENTS } from '../../shared/protocol.js';

/**
 * Sala del chat: quién está dentro y cómo se envían los eventos.
 * Los controladores usan esta clase en vez de Socket.IO directamente.
 */
export class ChatRoom {
  #io;
  #directory;
  #roomName;
  #capacity;

  /**
   * @param {{
   *   io: import('socket.io').Server,
   *   directory: import('../domain/user-directory.js').UserDirectory,
   *   roomName: string,
   *   capacity: number,
   * }} dependencies
   */
  constructor({ io, directory, roomName, capacity }) {
    this.#io = io;
    this.#directory = directory;
    this.#roomName = roomName;
    this.#capacity = capacity;
  }

  get size() {
    return this.#directory.size;
  }

  isFull() {
    return this.#directory.size >= this.#capacity;
  }

  /** @param {string} name */
  isNameTaken(name) {
    return this.#directory.isNameTaken(name);
  }

  /** @param {unknown} userId */
  hasMember(userId) {
    return this.#directory.has(userId);
  }

  /**
   * @param {import('socket.io').Socket} socket
   * @param {import('./user-session.js').UserSession} session
   */
  admit(socket, session) {
    this.#directory.add(session);
    socket.join(this.#roomName);
  }

  /** @param {import('./user-session.js').UserSession} session */
  remove(session) {
    this.#directory.remove(session.id);
  }

  /** Envía a todos los usuarios de la sala. */
  broadcast(event, payload) {
    this.#io.to(this.#roomName).emit(event, payload);
  }

  /** Envía a todos menos a quien originó el evento. */
  broadcastFrom(socket, event, payload) {
    socket.to(this.#roomName).emit(event, payload);
  }

  broadcastUsers() {
    this.broadcast(CHAT_EVENTS.users, this.#directory.list());
  }

  /** Envía solo a un usuario de la sala. */
  sendTo(userId, event, payload) {
    this.#io.to(userId).emit(event, payload);
  }
}
