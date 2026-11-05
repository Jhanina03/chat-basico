/**
 * Guarda en memoria los últimos mensajes del chat.
 */
export class MessageHistory {
  #messages = [];
  #capacity;

  /**
   * @param {number} capacity cantidad máxima de mensajes guardados
   */
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('La capacidad del historial debe ser un entero positivo');
    }
    this.#capacity = capacity;
  }

  /**
   * @param {import('./message-factory.js').ChatMessage} message
   */
  add(message) {
    this.#messages.push(message);
    if (this.#messages.length > this.#capacity) {
      this.#messages.shift();
    }
  }

  /**
   * @returns {import('./message-factory.js').ChatMessage[]} copia de los mensajes
   */
  list() {
    return [...this.#messages];
  }
}
