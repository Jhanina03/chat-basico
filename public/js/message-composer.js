/**
 * Caja de texto y botón para escribir mensajes.
 */
export class MessageComposer {
  #dom;
  #input;
  #sendButton;

  /**
   * @param {import('./dom-factory.js').DomFactory} dom
   */
  constructor(dom) {
    this.#dom = dom;
    this.#input = dom.byId('message-input');
    this.#sendButton = dom.byId('send-button');
  }

  /**
   * @param {(text: string) => void} handler recibe el texto ya recortado
   */
  onSend(handler) {
    this.#dom.bindSubmit({
      input: this.#input,
      button: this.#sendButton,
      onSubmit: (text) => {
        handler(text);
        this.#input.value = '';
        this.focus();
      },
    });
  }

  /** @param {number | undefined} maxLength */
  setMaxLength(maxLength) {
    this.#dom.setMaxLength(this.#input, maxLength);
  }

  focus() {
    this.#input.focus();
  }
}
