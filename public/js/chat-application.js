import { CHAT_EVENTS } from '../../shared/protocol.js';

export const RATE_LIMIT_NOTICE = 'Estás enviando mensajes muy rápido. Espera un momento.';

/**
 * Conecta las vistas del chat con el servidor.
 */
export class ChatApplication {
  #connect;
  #joinView;
  #composer;
  #chatView;
  #userListView;
  #createCallCoordinator;

  #socket = null;
  #selfId = null;
  #callCoordinator = null;

  /**
   * @param {{
   *   connect: () => import('socket.io-client').Socket,
   *   joinView: import('./join-view.js').JoinView,
   *   composer: import('./message-composer.js').MessageComposer,
   *   chatView: import('./chat-view.js').ChatView,
   *   userListView: import('./user-list-view.js').UserListView,
   *   createCallCoordinator: (socket: object, callbacks: object) => import('./call-coordinator.js').CallCoordinator,
   * }} dependencies
   */
  constructor({ connect, joinView, composer, chatView, userListView, createCallCoordinator }) {
    this.#connect = connect;
    this.#joinView = joinView;
    this.#composer = composer;
    this.#chatView = chatView;
    this.#userListView = userListView;
    this.#createCallCoordinator = createCallCoordinator;
  }

  /**
   * @param {{ nameLength?: number, textLength?: number }} limits
   */
  start(limits) {
    this.#joinView.setMaxLength(limits.nameLength);
    this.#composer.setMaxLength(limits.textLength);
    this.#joinView.onJoin((name) => this.#join(name));
    this.#composer.onSend((text) => this.#socket?.emit(CHAT_EVENTS.message, text));
    this.#userListView.onCall((user) => this.#callCoordinator?.call(user));
  }

  #join(name) {
    if (this.#socket !== null) {
      return;
    }
    this.#joinView.hide();
    this.#chatView.show();
    this.#socket = this.#connect();
    this.#callCoordinator = this.#createCallCoordinator(this.#socket, {
      notify: (text) => this.#chatView.renderNotice(text),
      onBusyChange: (busy) => this.#userListView.setCallingEnabled(!busy),
    });
    this.#callCoordinator.start();
    this.#bindConnectionEvents(this.#socket, name);
    this.#bindChatEvents(this.#socket);
    this.#composer.focus();
  }

  #bindConnectionEvents(socket, name) {
    socket.on('connect', () => {
      this.#chatView.setStatus('En línea');
      this.#chatView.clear();
      socket.emit(CHAT_EVENTS.join, name);
    });
    socket.on('disconnect', () => this.#chatView.setStatus('Desconectado'));
    socket.on(CHAT_EVENTS.welcome, ({ id }) => {
      this.#selfId = id;
    });
  }

  #bindChatEvents(socket) {
    socket.on(CHAT_EVENTS.history, (messages) => {
      for (const message of messages) {
        this.#renderMessage(message);
      }
    });
    socket.on(CHAT_EVENTS.message, (message) => this.#renderMessage(message));
    socket.on(CHAT_EVENTS.notice, (text) => this.#chatView.renderNotice(text));
    socket.on(CHAT_EVENTS.rateLimited, () => this.#chatView.renderNotice(RATE_LIMIT_NOTICE));
    socket.on(CHAT_EVENTS.users, (users) => {
      this.#userListView.render(users, this.#selfId);
      this.#callCoordinator.handleUsersChanged(users);
    });
  }

  #renderMessage(message) {
    this.#chatView.renderMessage(message, message.authorId === this.#selfId);
  }
}
