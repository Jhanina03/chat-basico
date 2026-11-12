import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openSqliteDatabase } from '../../src/persistence/sqlite-database.js';
import { SqliteMessageRepository } from '../../src/persistence/sqlite-message-repository.js';

let sequence = 0;

function message(text = 'Hola') {
  sequence += 1;
  return {
    id: `mensaje-${sequence}`,
    authorId: 'socket-1',
    author: 'Ana',
    text,
    sentAt: new Date(Date.UTC(2026, 0, 1, 10, 0, sequence)).toISOString(),
  };
}

function clientId() {
  return randomUUID();
}

function createRepository(capacity = 10) {
  const database = openSqliteDatabase(':memory:');
  return { database, repository: new SqliteMessageRepository({ database, capacity }) };
}

describe('SqliteMessageRepository', () => {
  it('guarda y devuelve los mensajes en orden, inmutables', () => {
    const { repository } = createRepository();
    const first = message('Primero');
    const second = message('Segundo');
    assert.equal(repository.save(first, clientId()), true);
    assert.equal(repository.save(second, clientId()), true);
    const stored = repository.listRecent();
    assert.deepEqual(stored, [first, second]);
    assert.ok(stored.every((item) => Object.isFrozen(item)));
  });

  it('no duplica un reintento con el mismo identificador del cliente', () => {
    const { repository } = createRepository();
    const retryId = clientId();
    assert.equal(repository.save(message('Original'), retryId), true);
    assert.equal(repository.save(message('Reintento'), retryId), false);
    assert.equal(repository.count(), 1);
    assert.equal(repository.listRecent()[0].text, 'Original');
  });

  it('conserva solo los mensajes más recientes', () => {
    const { repository } = createRepository(3);
    const saved = [];
    for (let index = 0; index < 5; index += 1) {
      const item = message(`m${index}`);
      saved.push(item);
      repository.save(item, clientId());
    }
    assert.equal(repository.count(), 3);
    assert.deepEqual(
      repository.listRecent().map((item) => item.text),
      saved.slice(-3).map((item) => item.text),
    );
  });

  it('deshace todo el guardado si falla una parte de la transacción', () => {
    const { database, repository } = createRepository(1);
    repository.save(message('Queda'), clientId());
    database.exec(`
      CREATE TRIGGER block_cleanup BEFORE DELETE ON messages
      BEGIN SELECT RAISE(ABORT, 'limpieza bloqueada'); END;
    `);
    assert.throws(() => repository.save(message('No debe quedar'), clientId()), /limpieza bloqueada/);
    assert.deepEqual(
      repository.listRecent().map((item) => item.text),
      ['Queda'],
    );
    database.exec('DROP TRIGGER block_cleanup');
    assert.equal(repository.save(message('Después del error'), clientId()), true);
  });

  it('rechaza datos que violan las restricciones de la tabla', () => {
    const { repository } = createRepository();
    assert.throws(() => repository.save(message(''), clientId()), /CHECK constraint failed/);
    assert.equal(repository.count(), 0);
    assert.equal(repository.save(message('Válido'), clientId()), true);
  });

  it('rechaza capacidades inválidas', () => {
    const database = openSqliteDatabase(':memory:');
    assert.throws(() => new SqliteMessageRepository({ database, capacity: 0 }), RangeError);
  });

  describe('en un archivo', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'chat-db-'));
    after(() => rmSync(directory, { recursive: true, force: true }));

    it('conserva los mensajes después de cerrar y abrir la base de datos', () => {
      const databasePath = path.join(directory, 'carpeta-nueva', 'chat.sqlite');
      const first = new SqliteMessageRepository({ database: openSqliteDatabase(databasePath), capacity: 5 });
      const saved = message('Persistente');
      first.save(saved, clientId());
      first.close();

      const database = openSqliteDatabase(databasePath);
      const reopened = new SqliteMessageRepository({ database, capacity: 5 });
      assert.deepEqual(reopened.listRecent(), [saved]);
      assert.equal(database.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
      reopened.close();
    });
  });
});
