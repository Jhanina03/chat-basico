/**
 * @typedef {object} ChatMessage
 * @property {string} id
 * @property {string} authorId
 * @property {string} author
 * @property {string} text
 * @property {string} sentAt fecha en formato ISO
 */

/**
 * Crea mensajes del chat a partir de lo que escribe el usuario.
 */
export class MessageFactory {
  #sanitizer;
  #clock;
  #idGenerator;
  #maxLength;

  /**
   * @param {{
   *   sanitizer: import('./text-sanitizer.js').TextSanitizer,
   *   clock: { now: () => Date },
   *   idGenerator: { next: () => string },
   *   maxLength: number,
   * }} dependencies
   */
  constructor({ sanitizer, clock, idGenerator, maxLength }) {
    this.#sanitizer = sanitizer;
    this.#clock = clock;
    this.#idGenerator = idGenerator;
    this.#maxLength = maxLength;
  }

  /**
   * @param {{ id: string, name: string }} author
   * @param {unknown} rawText
   * @returns {ChatMessage | null} null si el texto queda vacío o no es texto
   */
  create(author, rawText) {
    const text = this.#sanitizer.clean(rawText, this.#maxLength);
    if (text === '') {
      return null;
    }
    return Object.freeze({
      id: this.#idGenerator.next(),
      authorId: author.id,
      author: author.name,
      text,
      sentAt: this.#clock.now().toISOString(),
    });
  }
}
