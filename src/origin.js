/**
 * Indica si una conexión viene de la misma página que sirve el chat.
 * Los navegadores siempre envían la cabecera Origin; si no existe, la petición
 * no viene de un navegador y no puede usarse para un ataque entre sitios.
 * @param {string | undefined} origin cabecera Origin de la petición
 * @param {string | undefined} host cabecera Host de la petición
 * @returns {boolean}
 */
export function isAllowedOrigin(origin, host) {
  if (origin === undefined) {
    return true;
  }
  return URL.canParse(origin) && new URL(origin).host === host;
}
