import { requirePositiveInteger } from '../domain/guards.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS messages (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    client_message_id TEXT NOT NULL UNIQUE,
    author_id TEXT NOT NULL,
    author TEXT NOT NULL CHECK (length(author) BETWEEN 1 AND 200),
    text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 5000),
    sent_at TEXT NOT NULL
  ) STRICT;
`;

const INSERT_MESSAGE = `
  INSERT INTO messages (id, client_message_id, author_id, author, text, sent_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT (client_message_id) DO NOTHING
`;

const KEEP_LATEST = `
  DELETE FROM messages
  WHERE seq NOT IN (SELECT seq FROM messages ORDER BY seq DESC LIMIT ?)
`;

const SELECT_LATEST = `
  SELECT id, author_id, author, text, sent_at
  FROM (SELECT * FROM messages ORDER BY seq DESC LIMIT ?)
  ORDER BY seq
`;

const COUNT_MESSAGES = 'SELECT COUNT(*) AS total FROM messages';

/**
 * Guarda los mensajes en SQLite y conserva solo los más recientes.
 * Cada guardado es una transacción: o se guarda todo, o no se guarda nada.
 */
export class SqliteMessageRepository {
  #database;
  #capacity;
  #insertMessage;
  #keepLatest;
  #selectLatest;
  #countMessages;

  /**
   * @param {{ database: import('node:sqlite').DatabaseSync, capacity: number }} options
   */
  constructor({ database, capacity }) {
    this.#capacity = requirePositiveInteger(capacity, 'La capacidad del historial');
    this.#database = database;
    this.#database.exec(SCHEMA);
    this.#insertMessage = database.prepare(INSERT_MESSAGE);
    this.#keepLatest = database.prepare(KEEP_LATEST);
    this.#selectLatest = database.prepare(SELECT_LATEST);
    this.#countMessages = database.prepare(COUNT_MESSAGES);
  }

  /**
   * Guarda un mensaje. Si el navegador reintenta con el mismo clientMessageId,
   * no se duplica (operación idempotente).
   * @param {import('../domain/message-factory.js').ChatMessage} message
   * @param {string} clientMessageId
   * @returns {boolean} true si se guardó, false si ya existía
   */
  save(message, clientMessageId) {
    this.#database.exec('BEGIN IMMEDIATE');
    try {
      const { changes } = this.#insertMessage.run(
        message.id,
        clientMessageId,
        message.authorId,
        message.author,
        message.text,
        message.sentAt,
      );
      if (changes > 0) {
        this.#keepLatest.run(this.#capacity);
      }
      this.#database.exec('COMMIT');
      return changes > 0;
    } catch (error) {
      this.#database.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * @returns {import('../domain/message-factory.js').ChatMessage[]} del más antiguo al más reciente
   */
  listRecent() {
    return this.#selectLatest.all(this.#capacity).map((row) =>
      Object.freeze({
        id: row.id,
        authorId: row.author_id,
        author: row.author,
        text: row.text,
        sentAt: row.sent_at,
      }),
    );
  }

  /** @returns {number} cantidad de mensajes guardados */
  count() {
    return Number(this.#countMessages.get().total);
  }

  close() {
    this.#database.close();
  }
}
