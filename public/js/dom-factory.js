/**
 * Busca y crea elementos de la página. El texto siempre se inserta con textContent,
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
   * Aplica el límite de caracteres a una caja de texto, solo si es un entero.
   * @param {HTMLInputElement} input
   * @param {unknown} maxLength
   */
  setMaxLength(input, maxLength) {
    if (Number.isInteger(maxLength)) {
      input.maxLength = maxLength;
    }
  }

  /**
   * Ejecuta la acción al pulsar el botón o al presionar Enter en la caja de texto.
   * Entrega el texto ya recortado y no hace nada si está vacío.
   * @param {{ input: HTMLInputElement, button: HTMLButtonElement, onSubmit: (text: string) => void }} controls
   */
  bindSubmit({ input, button, onSubmit }) {
    const submit = () => {
      const text = input.value.trim();
      if (text !== '') {
        onSubmit(text);
      }
    };
    button.addEventListener('click', submit);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    });
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
