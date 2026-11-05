import { randomUUID } from 'node:crypto';
import { DEFAULT_NAME, HISTORY_LIMIT, MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from './config.js';

/** Caracteres de control y de dirección del texto (usados para disfrazar nombres). */
const UNSAFE_CHARS = /[\p{Cc}\p{Bidi_Control}]/gu;
const graphemeSegmenter = new Intl.Segmenter('es', { granularity: 'grapheme' });

/**
 * Recorta un texto por caracteres visibles, sin partir emojis.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncateGraphemes(text, maxLength) {
  const graphemes = Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment);
  return graphemes.slice(0, maxLength).join('');
}

/**
 * Limpia un texto: quita caracteres peligrosos, espacios extremos y lo recorta.
 * @param {unknown} value
 * @param {number} maxLength
 * @returns {string}
 */
export function cleanText(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }
  const withoutUnsafe = value.replaceAll(UNSAFE_CHARS, '').trim();
  return truncateGraphemes(withoutUnsafe, maxLength).trim();
}

/**
 * Devuelve un nombre válido o el nombre por defecto si viene vacío.
 * @param {unknown} name
 * @returns {string}
 */
export function cleanName(name) {
  return cleanText(name, MAX_NAME_LENGTH) || DEFAULT_NAME;
}

/**
 * Crea un mensaje listo para enviarse. Devuelve null si el texto no es válido.
 * @param {string} author
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

/** Historial en memoria con un tamaño máximo. */
export class MessageHistory {
  #items = [];
  #limit;

  constructor(limit = HISTORY_LIMIT) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError('El límite del historial debe ser un entero positivo');
    }
    this.#limit = limit;
  }

  add(message) {
    this.#items.push(message);
    if (this.#items.length > this.#limit) {
      this.#items.shift();
    }
  }

  list() {
    return [...this.#items];
  }
}
