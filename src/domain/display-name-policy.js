/**
 * Decide qué nombre se muestra para un usuario.
 */
export class DisplayNamePolicy {
  #sanitizer;
  #maxLength;
  #fallbackName;

  /**
   * @param {{ sanitizer: import('./text-sanitizer.js').TextSanitizer, maxLength: number, fallbackName: string }} options
   */
  constructor({ sanitizer, maxLength, fallbackName }) {
    this.#sanitizer = sanitizer;
    this.#maxLength = maxLength;
    this.#fallbackName = fallbackName;
  }

  /**
   * @param {unknown} rawName nombre tal como lo envió el navegador
   * @returns {string} nombre limpio o el nombre por defecto
   */
  normalize(rawName) {
    return this.#sanitizer.clean(rawName, this.#maxLength) || this.#fallbackName;
  }
}
