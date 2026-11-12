/**
 * @typedef {object} OnlineUser
 * @property {string} id
 * @property {string} name
 */

/**
 * Clave para comparar nombres sin importar mayúsculas ni variantes Unicode
 * (por ejemplo, "ＡＮＡ" con letras de ancho completo cuenta igual que "ana").
 */
function nameKey(name) {
  return name.normalize('NFKC').toLocaleLowerCase('es');
}

/**
 * Lista de usuarios conectados al chat.
 */
export class UserDirectory {
  #users = new Map();
  #nameKeys = new Set();

  get size() {
    return this.#users.size;
  }

  /**
   * @param {OnlineUser} user
   */
  add(user) {
    this.#users.set(user.id, Object.freeze({ id: user.id, name: user.name }));
    this.#nameKeys.add(nameKey(user.name));
  }

  /**
   * @param {string} userId
   */
  remove(userId) {
    const user = this.#users.get(userId);
    if (user === undefined) {
      return;
    }
    this.#users.delete(userId);
    this.#nameKeys.delete(nameKey(user.name));
  }

  /**
   * @param {unknown} userId
   * @returns {boolean}
   */
  has(userId) {
    return this.#users.has(userId);
  }

  /**
   * @param {string} name
   * @returns {boolean} true si otro usuario conectado ya usa ese nombre
   */
  isNameTaken(name) {
    return this.#nameKeys.has(nameKey(name));
  }

  /**
   * @returns {OnlineUser[]}
   */
  list() {
    return [...this.#users.values()];
  }
}
