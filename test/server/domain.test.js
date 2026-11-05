import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DisplayNamePolicy } from '../../src/domain/display-name-policy.js';
import { MessageFactory } from '../../src/domain/message-factory.js';
import { MessageHistory } from '../../src/domain/message-history.js';
import { TextSanitizer } from '../../src/domain/text-sanitizer.js';
import { UserDirectory } from '../../src/domain/user-directory.js';

const BELL = String.fromCodePoint(0x07);
const DELETE = String.fromCodePoint(0x7f);
const RIGHT_TO_LEFT_OVERRIDE = String.fromCodePoint(0x202e);
const LEFT_TO_RIGHT_ISOLATE = String.fromCodePoint(0x2066);
const THUMBS_UP_MEDIUM_SKIN = String.fromCodePoint(0x1f44d, 0x1f3fd);

describe('TextSanitizer', () => {
  const sanitizer = new TextSanitizer();

  it('quita espacios extremos y caracteres de control', () => {
    assert.equal(sanitizer.clean(`  hola${BELL} mundo${DELETE}  `, 100), 'hola mundo');
  });

  it('quita caracteres que invierten la dirección del texto', () => {
    assert.equal(sanitizer.clean(`Ana${RIGHT_TO_LEFT_OVERRIDE}txt${LEFT_TO_RIGHT_ISOLATE}`, 100), 'Anatxt');
  });

  it('recorta al máximo de caracteres visibles sin partir emojis', () => {
    assert.equal(sanitizer.clean('abcdef', 3), 'abc');
    assert.equal(sanitizer.clean(`ab${THUMBS_UP_MEDIUM_SKIN}cd`, 3), `ab${THUMBS_UP_MEDIUM_SKIN}`);
  });

  it('no deja espacios al final después de recortar', () => {
    assert.equal(sanitizer.clean('ab cd', 3), 'ab');
  });

  it('devuelve vacío si el valor no es texto', () => {
    for (const value of [42, undefined, null, ['hola'], { text: 'hola' }]) {
      assert.equal(sanitizer.clean(value, 10), '');
    }
  });
});

describe('DisplayNamePolicy', () => {
  const policy = new DisplayNamePolicy({ sanitizer: new TextSanitizer(), maxLength: 5, fallbackName: 'Anónimo' });

  it('limpia y recorta el nombre', () => {
    assert.equal(policy.normalize('  Jhanina  '), 'Jhani');
  });

  it('usa el nombre por defecto si queda vacío', () => {
    assert.equal(policy.normalize('   '), 'Anónimo');
    assert.equal(policy.normalize(123), 'Anónimo');
  });
});

describe('MessageFactory', () => {
  const fixedDate = new Date('2026-01-01T10:00:00.000Z');
  const factory = new MessageFactory({
    sanitizer: new TextSanitizer(),
    clock: { now: () => fixedDate },
    idGenerator: { next: () => 'mensaje-1' },
    maxLength: 10,
  });
  const author = { id: 'socket-1', name: 'Ana' };

  it('crea un mensaje inmutable con autor, texto y fecha', () => {
    const message = factory.create(author, '  Hola  ');
    assert.deepEqual(message, {
      id: 'mensaje-1',
      authorId: 'socket-1',
      author: 'Ana',
      text: 'Hola',
      sentAt: fixedDate.toISOString(),
    });
    assert.equal(Object.isFrozen(message), true);
  });

  it('recorta mensajes largos', () => {
    assert.equal(factory.create(author, 'a'.repeat(50)).text.length, 10);
  });

  it('rechaza mensajes vacíos o que no son texto', () => {
    assert.equal(factory.create(author, '   '), null);
    assert.equal(factory.create(author, { text: 'hola' }), null);
  });
});

describe('MessageHistory', () => {
  it('guarda solo los últimos mensajes', () => {
    const history = new MessageHistory(2);
    history.add({ id: '1' });
    history.add({ id: '2' });
    history.add({ id: '3' });
    assert.deepEqual(history.list().map((message) => message.id), ['2', '3']);
  });

  it('entrega una copia que no modifica el historial', () => {
    const history = new MessageHistory(5);
    history.add({ id: '1' });
    history.list().pop();
    assert.equal(history.list().length, 1);
  });

  it('rechaza capacidades inválidas', () => {
    assert.throws(() => new MessageHistory(0), RangeError);
    assert.throws(() => new MessageHistory(2.5), RangeError);
  });
});

describe('UserDirectory', () => {
  it('agrega, consulta y quita usuarios', () => {
    const directory = new UserDirectory();
    directory.add({ id: 'a', name: 'Ana', secret: 'no se copia' });
    directory.add({ id: 'b', name: 'Luis' });
    assert.equal(directory.has('a'), true);
    assert.deepEqual(directory.list(), [
      { id: 'a', name: 'Ana' },
      { id: 'b', name: 'Luis' },
    ]);
    directory.remove('a');
    assert.equal(directory.has('a'), false);
    assert.deepEqual(directory.list(), [{ id: 'b', name: 'Luis' }]);
  });
});
