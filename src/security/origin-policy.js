/**
 * Decide si una conexión de Socket.IO puede entrar según su origen.
 */
export class OriginPolicy {
  /**
   * Los navegadores siempre envían la cabecera Origin. Si no existe, la petición
   * no viene de un navegador y no puede usarse para un ataque entre sitios.
   * @param {string | undefined} origin cabecera Origin
   * @param {string | undefined} host cabecera Host
   * @returns {boolean}
   */
  isAllowed(origin, host) {
    if (origin === undefined) {
      return true;
    }
    return URL.canParse(origin) && new URL(origin).host === host;
  }
}
