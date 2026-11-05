/**
 * Limita cuántas acciones se permiten dentro de una ventana de tiempo.
 */
export class RateLimiter {
  #limit;
  #intervalMs;
  #now;
  #timestamps = [];

  /**
   * @param {{ limit: number, intervalMs: number, now?: () => number }} options
   */
  constructor({ limit, intervalMs, now = Date.now }) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError('El límite debe ser un entero positivo');
    }
    if (!Number.isInteger(intervalMs) || intervalMs < 1) {
      throw new RangeError('El intervalo debe ser un entero positivo');
    }
    this.#limit = limit;
    this.#intervalMs = intervalMs;
    this.#now = now;
  }

  /**
   * Registra una acción si todavía hay cupo.
   * @returns {boolean} true si la acción está permitida.
   */
  tryConsume() {
    const current = this.#now();
    const windowStart = current - this.#intervalMs;
    this.#timestamps = this.#timestamps.filter((timestamp) => timestamp > windowStart);
    if (this.#timestamps.length >= this.#limit) {
      return false;
    }
    this.#timestamps.push(current);
    return true;
  }
}
