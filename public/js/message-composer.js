/**
 * Caja de texto y botón para escribir mensajes.
 */
export class MessageComposer {
  #form;
  #input;

  /**
   * @param {import('./dom-factory.js').DomFactory} dom
   */
  constructor(dom) {
    this.#form = dom.byId('message-form');
    this.#input = dom.byId('message-input');
  }

  /**
   * @param {(text: string) => void} handler se llama con el texto ya recortado
   */
  onSend(handler) {
    this.#form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = this.#input.value.trim();
      if (text === '') {
        return;
      }
      handler(text);
      this.#input.value = '';
      this.focus();
    });
  }

  /**
   * @param {number | undefined} maxLength
   */
  setMaxLength(maxLength) {
    if (Number.isInteger(maxLength)) {
      this.#input.maxLength = maxLength;
    }
  }

  focus() {
    this.#input.focus();
  }
}
