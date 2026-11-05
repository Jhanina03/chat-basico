/**
 * @typedef {object} OnlineUser
 * @property {string} id
 * @property {string} name
 */

/**
 * Lista de usuarios conectados al chat.
 */
export class UserDirectory {
  #users = new Map();

  /**
   * @param {OnlineUser} user
   */
  add(user) {
    this.#users.set(user.id, Object.freeze({ id: user.id, name: user.name }));
  }

  /**
   * @param {string} userId
   */
  remove(userId) {
    this.#users.delete(userId);
  }

  /**
   * @param {unknown} userId
   * @returns {boolean}
   */
  has(userId) {
    return this.#users.has(userId);
  }

  /**
   * @returns {OnlineUser[]}
   */
  list() {
    return [...this.#users.values()];
  }
}
