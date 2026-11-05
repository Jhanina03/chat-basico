/**
 * Muestra los mensajes, los avisos y el estado de la conexión.
 */
export class ChatView {
  #dom;
  #screen;
  #messageList;
  #statusLabel;
  #timeFormatter;

  /**
   * @param {import('./dom-factory.js').DomFactory} dom
   * @param {Intl.DateTimeFormat} [timeFormatter]
   */
  constructor(dom, timeFormatter = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })) {
    this.#dom = dom;
    this.#screen = dom.byId('chat-screen');
    this.#messageList = dom.byId('messages');
    this.#statusLabel = dom.byId('status');
    this.#timeFormatter = timeFormatter;
  }

  show() {
    this.#screen.hidden = false;
  }

  /**
   * @param {string} text
   */
  setStatus(text) {
    this.#statusLabel.textContent = text;
  }

  clear() {
    this.#messageList.replaceChildren();
  }

  /**
   * @param {{ author: string, text: string, sentAt: string }} message
   * @param {boolean} isOwn true si lo envió este usuario
   */
  renderMessage(message, isOwn) {
    const item = this.#dom.textElement('li', isOwn ? 'message mine' : 'message', '');
    item.append(
      this.#dom.textElement('span', 'message-author', message.author),
      this.#dom.textElement('span', 'message-text', message.text),
      this.#dom.textElement('time', 'message-time', this.#timeFormatter.format(new Date(message.sentAt))),
    );
    this.#append(item);
  }

  /**
   * @param {string} text
   */
  renderNotice(text) {
    this.#append(this.#dom.textElement('li', 'notice', text));
  }

  #append(item) {
    this.#messageList.append(item);
    this.#messageList.scrollTop = this.#messageList.scrollHeight;
  }
}
