/**
 * Pantalla de entrada donde se escribe el nombre.
 */
export class JoinView {
  #dom;
  #screen;
  #nameInput;
  #joinButton;

  /**
   * @param {import('./dom-factory.js').DomFactory} dom
   */
  constructor(dom) {
    this.#dom = dom;
    this.#screen = dom.byId('join-screen');
    this.#nameInput = dom.byId('name-input');
    this.#joinButton = dom.byId('join-button');
  }

  /**
   * @param {(name: string) => void} handler recibe el nombre ya recortado
   */
  onJoin(handler) {
    this.#dom.bindSubmit({ input: this.#nameInput, button: this.#joinButton, onSubmit: handler });
  }

  /** @param {number | undefined} maxLength */
  setMaxLength(maxLength) {
    this.#dom.setMaxLength(this.#nameInput, maxLength);
  }

  hide() {
    this.#screen.hidden = true;
  }
}
