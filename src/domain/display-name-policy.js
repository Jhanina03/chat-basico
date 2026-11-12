/**
 * Decide qué nombre se muestra para un usuario.
 * Regla de negocio: no puede haber dos usuarios conectados con el mismo nombre.
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

  /**
   * Devuelve un nombre libre: si "Ana" ya existe, prueba "Ana (2)", "Ana (3)"...
   * Termina siempre porque la cantidad de usuarios conectados es limitada.
   * @param {unknown} rawName
   * @param {(name: string) => boolean} isTaken
   * @returns {string}
   */
  normalizeUnique(rawName, isTaken) {
    const baseName = this.normalize(rawName);
    let candidate = baseName;
    let suffix = 1;
    while (isTaken(candidate)) {
      suffix += 1;
      candidate = this.#withSuffix(baseName, suffix);
    }
    return candidate;
  }

  #withSuffix(baseName, suffix) {
    const label = ` (${suffix})`;
    return this.#sanitizer.clean(baseName, this.#maxLength - label.length) + label;
  }
}
