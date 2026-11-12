import { isPlainObject } from './guards.js';

/** UUID versión 1 a 8 (lo genera el navegador con crypto.randomUUID). */
const CLIENT_MESSAGE_ID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

/**
 * @typedef {object} ChatMessage
 * @property {string} id
 * @property {string} authorId
 * @property {string} author
 * @property {string} text
 * @property {string} sentAt fecha en formato ISO
 */

/**
 * @typedef {object} MessageDraft
 * @property {string} clientMessageId identificador del navegador para detectar reintentos
 * @property {ChatMessage} message mensaje que se guarda y se reparte
 */

/**
 * Crea mensajes del chat a partir de la solicitud que envía el navegador.
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
   * @param {unknown} request se espera { clientMessageId: string (UUID), text: string }
   * @returns {MessageDraft | null} null si la solicitud o el texto no son válidos
   */
  create(author, request) {
    if (!isPlainObject(request) || !MessageFactory.#isValidClientId(request.clientMessageId)) {
      return null;
    }
    const text = this.#sanitizer.clean(request.text, this.#maxLength);
    if (text === '') {
      return null;
    }
    const message = Object.freeze({
      id: this.#idGenerator.next(),
      authorId: author.id,
      author: author.name,
      text,
      sentAt: this.#clock.now().toISOString(),
    });
    return Object.freeze({ clientMessageId: request.clientMessageId.toLowerCase(), message });
  }

  static #isValidClientId(value) {
    return typeof value === 'string' && CLIENT_MESSAGE_ID_PATTERN.test(value);
  }
}
