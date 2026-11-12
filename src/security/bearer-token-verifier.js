import { createHash, timingSafeEqual } from 'node:crypto';

const BEARER_PREFIX = 'Bearer ';

function digest(value) {
  return createHash('sha256').update(value).digest();
}

/**
 * Protege rutas internas (como /metrics) con un token secreto.
 * La comparación es de tiempo constante para no filtrar el token por tiempos de respuesta.
 */
export class BearerTokenVerifier {
  #expectedDigest;

  /**
   * @param {string | null} token null desactiva la ruta protegida
   */
  constructor(token) {
    this.#expectedDigest = token ? digest(token) : null;
  }

  get isEnabled() {
    return this.#expectedDigest !== null;
  }

  /**
   * @param {string | undefined} authorizationHeader cabecera Authorization
   * @returns {boolean}
   */
  isAuthorized(authorizationHeader) {
    if (!this.isEnabled || typeof authorizationHeader !== 'string' || !authorizationHeader.startsWith(BEARER_PREFIX)) {
      return false;
    }
    return timingSafeEqual(digest(authorizationHeader.slice(BEARER_PREFIX.length)), this.#expectedDigest);
  }
}
