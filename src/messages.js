import { randomUUID } from 'node:crypto';

export const MAX_NAME_LENGTH = 30;
export const MAX_TEXT_LENGTH = 500;
export const HISTORY_LIMIT = 50;

const FIRST_PRINTABLE_CODE = 32;
const DELETE_CODE = 127;

/**
 * Indica si un carácter es de control (no imprimible).
 * @param {string} char
 * @returns {boolean}
 */
function isControlChar(char) {
  const code = char.codePointAt(0);
  return code < FIRST_PRINTABLE_CODE || code === DELETE_CODE;
}

/**
 * Limpia un texto: quita caracteres de control, espacios extremos y lo recorta.
 * @param {unknown} value
 * @param {number} maxLength
 * @returns {string}
 */
export function cleanText(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }
  return Array.from(value)
    .filter((char) => !isControlChar(char))
    .join('')
    .trim()
    .slice(0, maxLength);
}

/**
 * Devuelve un nombre válido o "Anónimo" si viene vacío.
 * @param {unknown} name
 * @returns {string}
 */
export function cleanName(name) {
  return cleanText(name, MAX_NAME_LENGTH) || 'Anónimo';
}

/**
 * Crea un mensaje listo para enviarse a los clientes.
 * Devuelve null si el texto no es válido.
 * @param {unknown} author
 * @param {unknown} text
 * @param {Date} [now]
 * @returns {{ id: string, author: string, text: string, sentAt: string } | null}
 */
export function createMessage(author, text, now = new Date()) {
  const cleanedText = cleanText(text, MAX_TEXT_LENGTH);
  if (cleanedText === '') {
    return null;
  }
  return {
    id: randomUUID(),
    author: cleanName(author),
    text: cleanedText,
    sentAt: now.toISOString(),
  };
}

/**
 * Historial en memoria con un tamaño máximo.
 */
export class MessageHistory {
  #items = [];

  constructor(limit = HISTORY_LIMIT) {
    this.limit = limit;
  }

  add(message) {
    this.#items.push(message);
    if (this.#items.length > this.limit) {
      this.#items.shift();
    }
  }

  list() {
    return [...this.#items];
  }
}
