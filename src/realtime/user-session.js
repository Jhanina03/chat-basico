/**
 * Estado de una conexión: quién es y si ya entró al chat.
 */
export class UserSession {
  #id;
  #name = null;

  /**
   * @param {string} id identificador de la conexión
   */
  constructor(id) {
    this.#id = id;
  }

  get id() {
    return this.#id;
  }

  get name() {
    return this.#name;
  }

  get hasJoined() {
    return this.#name !== null;
  }

  /**
   * Registra el nombre. Solo se puede hacer una vez por conexión.
   * @param {string} name nombre ya validado
   * @returns {boolean} false si la sesión ya tenía nombre
   */
  join(name) {
    if (this.hasJoined) {
      return false;
    }
    this.#name = name;
    return true;
  }
}
