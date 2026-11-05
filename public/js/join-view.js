/**
 * Pantalla de entrada donde el usuario escribe su nombre.
 */
export class JoinView {
  #screen;
  #form;
  #nameInput;

  /**
   * @param {import('./dom-factory.js').DomFactory} dom
   */
  constructor(dom) {
    this.#screen = dom.byId('join-screen');
    this.#form = dom.byId('join-form');
    this.#nameInput = dom.byId('name-input');
  }

  /**
   * @param {(name: string) => void} handler se llama con el nombre ya recortado
   */
  onJoin(handler) {
    this.#form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = this.#nameInput.value.trim();
      if (name !== '') {
        handler(name);
      }
    });
  }

  /**
   * @param {number | undefined} maxLength
   */
  setMaxLength(maxLength) {
    if (Number.isInteger(maxLength)) {
      this.#nameInput.maxLength = maxLength;
    }
  }

  hide() {
    this.#screen.hidden = true;
  }
}
