/**
 * Busca y crea elementos de la página. Todo el texto se inserta con textContent,
 * nunca como HTML, para evitar inyección de código (XSS).
 */
export class DomFactory {
  #document;

  /**
   * @param {Document} document
   */
  constructor(document) {
    this.#document = document;
  }

  /**
   * @param {string} id
   * @returns {HTMLElement}
   */
  byId(id) {
    const element = this.#document.getElementById(id);
    if (element === null) {
      throw new Error(`No existe el elemento #${id} en la página`);
    }
    return element;
  }

  /**
   * @param {string} tag
   * @param {string} className
   * @param {string} text
   * @returns {HTMLElement}
   */
  textElement(tag, className, text) {
    const element = this.#document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }

  /**
   * @param {string} label
   * @param {string} className
   * @returns {HTMLButtonElement}
   */
  button(label, className) {
    const button = this.textElement('button', className, label);
    button.type = 'button';
    return button;
  }
}
