import { requirePositiveInteger } from '../domain/guards.js';

/**
 * Limita cuántas acciones se permiten dentro de una ventana de tiempo.
 */
export class RateLimiter {
  #limit;
  #intervalMs;
  #clock;
  #timestamps = [];

  /**
   * @param {{ limit: number, intervalMs: number, clock: { now: () => Date } }} options
   */
  constructor({ limit, intervalMs, clock }) {
    this.#limit = requirePositiveInteger(limit, 'El límite');
    this.#intervalMs = requirePositiveInteger(intervalMs, 'El intervalo');
    this.#clock = clock;
  }

  /**
   * Registra una acción si todavía hay cupo.
   * @returns {boolean} true si la acción está permitida
   */
  tryConsume() {
    const current = this.#clock.now().getTime();
    const windowStart = current - this.#intervalMs;
    this.#timestamps = this.#timestamps.filter((timestamp) => timestamp > windowStart);
    if (this.#timestamps.length >= this.#limit) {
      return false;
    }
    this.#timestamps.push(current);
    return true;
  }
}
