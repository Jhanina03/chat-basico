/**
 * Avisos del chat que el servidor envía a todos los usuarios.
 */
export class ChatNotices {
  /** @param {string} name */
  joined(name) {
    return `${name} entró al chat`;
  }

  /** @param {string} name */
  left(name) {
    return `${name} salió del chat`;
  }
}
