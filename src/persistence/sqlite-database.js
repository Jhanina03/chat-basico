import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const IN_MEMORY = ':memory:';
const BUSY_TIMEOUT_MS = 5_000;

/**
 * Abre la base de datos SQLite (incluida en Node.js, sin dependencias nativas).
 * @param {string} databasePath ruta del archivo, o ":memory:" para pruebas
 * @returns {DatabaseSync}
 */
export function openSqliteDatabase(databasePath) {
  if (databasePath !== IN_MEMORY) {
    mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  }
  const database = new DatabaseSync(databasePath);
  database.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
  if (databasePath !== IN_MEMORY) {
    database.exec('PRAGMA journal_mode = WAL');
  }
  return database;
}
