import { ACK_STATUS, CHAT_EVENTS, REJECTION_REASONS } from '../../shared/protocol.js';

/**
 * Conecta las vistas del chat con el servidor.
 */
export class ChatApplication {
  #connect;
  #views;
  #texts;
  #createCallCoordinator;
  #createMessageSender;

  #socket = null;
  #selfId = null;
  #callCoordinator = null;
  #messageSender = null;

  /**
   * @param {{
   *   connect: () => import('socket.io-client').Socket,
   *   views: {
   *     join: import('./join-view.js').JoinView,
   *     composer: import('./message-composer.js').MessageComposer,
   *     chat: import('./chat-view.js').ChatView,
   *     users: import('./contact-list-view.js').ContactListView,
   *   },
   *   texts: import('./chat-texts.js').ChatTexts,
   *   createCallCoordinator: (socket: object, callbacks: object) => import('./call-coordinator.js').CallCoordinator,
   *   createMessageSender: (socket: object, onProblem: (reason: string) => void) => import('./message-sender.js').MessageSender,
   * }} dependencies
   */
  constructor({ connect, views, texts, createCallCoordinator, createMessageSender }) {
    this.#connect = connect;
    this.#views = views;
    this.#texts = texts;
    this.#createCallCoordinator = createCallCoordinator;
    this.#createMessageSender = createMessageSender;
  }

  /**
   * @param {{ nameLength?: number, textLength?: number }} limits
   */
  start(limits) {
    this.#views.join.setMaxLength(limits.nameLength);
    this.#views.composer.setMaxLength(limits.textLength);
    this.#views.join.onJoin((name) => this.#join(name));
    this.#views.composer.onSend((text) => this.#messageSender?.send(text));
    this.#views.users.onCall((user) => this.#callCoordinator?.call(user));
  }

  #join(name) {
    if (this.#socket !== null) {
      return;
    }
    this.#views.join.hide();
    this.#views.chat.show();
    this.#socket = this.#connect();
    this.#messageSender = this.#createMessageSender(this.#socket, (reason) => this.#showProblem(reason));
    this.#callCoordinator = this.#createCallCoordinator(this.#socket, {
      notify: (text) => this.#views.chat.renderNotice(text),
      onBusyChange: (busy) => this.#views.users.setCallingEnabled(!busy),
    });
    this.#callCoordinator.start();
    this.#bindConnectionEvents(this.#socket, name);
    this.#bindChatEvents(this.#socket);
    this.#views.composer.focus();
  }

  #bindConnectionEvents(socket, name) {
    socket.on('connect', () => {
      this.#views.chat.setStatus(this.#texts.online());
      this.#views.chat.clear();
      socket.emit(CHAT_EVENTS.join, name, (response) => this.#handleJoinResponse(response));
    });
    socket.on('disconnect', () => this.#views.chat.setStatus(this.#texts.offline()));
  }

  #bindChatEvents(socket) {
    socket.on(CHAT_EVENTS.message, (message) => this.#renderMessage(message));
    socket.on(CHAT_EVENTS.notice, (text) => this.#views.chat.renderNotice(text));
    socket.on(CHAT_EVENTS.rateLimited, () => this.#showProblem(REJECTION_REASONS.rateLimited));
    socket.on(CHAT_EVENTS.serverError, () => this.#showProblem(REJECTION_REASONS.serverError));
    socket.on(CHAT_EVENTS.users, (users) => {
      this.#views.users.render(users, this.#selfId);
      this.#callCoordinator.handleUsersChanged(users);
    });
  }

  #handleJoinResponse(response) {
    if (response?.status !== ACK_STATUS.joined) {
      this.#showProblem(response?.reason);
      return;
    }
    this.#selfId = response.id;
    for (const message of response.history) {
      this.#renderMessage(message);
    }
  }

  #renderMessage(message) {
    this.#views.chat.renderMessage(message, message.authorId === this.#selfId);
  }

  #showProblem(reason) {
    this.#views.chat.renderNotice(this.#texts.problem(reason));
  }
}
