export const ADMISSION_REJECTIONS = Object.freeze({
  origin: 'origin',
  capacity: 'capacity',
});

/**
 * Decide si una nueva conexión de Socket.IO puede entrar:
 * debe venir de esta misma página y no superar el máximo de conexiones.
 */
export class ConnectionAdmission {
  #originPolicy;
  #maxConnections;
  #countConnections;

  /**
   * @param {{
   *   originPolicy: import('./origin-policy.js').OriginPolicy,
   *   maxConnections: number,
   *   countConnections: () => number,
   * }} dependencies
   */
  constructor({ originPolicy, maxConnections, countConnections }) {
    this.#originPolicy = originPolicy;
    this.#maxConnections = maxConnections;
    this.#countConnections = countConnections;
  }

  /**
   * @param {{ origin: string | undefined, host: string | undefined }} request
   * @returns {{ allowed: true } | { allowed: false, reason: string }}
   */
  evaluate({ origin, host }) {
    if (!this.#originPolicy.isAllowed(origin, host)) {
      return { allowed: false, reason: ADMISSION_REJECTIONS.origin };
    }
    if (this.#countConnections() >= this.#maxConnections) {
      return { allowed: false, reason: ADMISSION_REJECTIONS.capacity };
    }
    return { allowed: true };
  }
}
