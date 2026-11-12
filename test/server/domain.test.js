import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ChatNotices } from '../../src/domain/chat-notices.js';
import { DisplayNamePolicy } from '../../src/domain/display-name-policy.js';
import { isPlainObject, requirePositiveInteger } from '../../src/domain/guards.js';
import { MessageFactory } from '../../src/domain/message-factory.js';
import { TextSanitizer } from '../../src/domain/text-sanitizer.js';
import { UserDirectory } from '../../src/domain/user-directory.js';

const BELL = String.fromCodePoint(0x07);
const DELETE = String.fromCodePoint(0x7f);
const RIGHT_TO_LEFT_OVERRIDE = String.fromCodePoint(0x202e);
const LEFT_TO_RIGHT_ISOLATE = String.fromCodePoint(0x2066);
const THUMBS_UP_MEDIUM_SKIN = String.fromCodePoint(0x1f44d, 0x1f3fd);
const FULLWIDTH_ANA = String.fromCodePoint(0xff21, 0xff2e, 0xff21);
const CLIENT_ID = '3f1c2b9e-8d4a-4c1e-9b2f-1a2b3c4d5e6f';

describe('guards', () => {
  it('reconoce objetos simples', () => {
    assert.equal(isPlainObject({ a: 1 }), true);
    for (const value of [null, undefined, [], 'texto', 5]) {
      assert.equal(isPlainObject(value), false);
    }
  });

  it('exige enteros positivos con un mensaje claro', () => {
    assert.equal(requirePositiveInteger(3, 'El valor'), 3);
    for (const value of [0, -1, 1.5, '3', null]) {
      assert.throws(() => requirePositiveInteger(value, 'El valor'), /El valor debe ser un entero positivo/);
    }
  });
});

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
  const policy = new DisplayNamePolicy({ sanitizer: new TextSanitizer(), maxLength: 8, fallbackName: 'Anónimo' });

  it('limpia y recorta el nombre', () => {
    assert.equal(policy.normalize('  Jhanina Conteron  '), 'Jhanina');
  });

  it('usa el nombre por defecto si queda vacío o no es texto', () => {
    assert.equal(policy.normalize('   '), 'Anónimo');
    assert.equal(policy.normalize(123), 'Anónimo');
  });

  it('devuelve el mismo nombre si está libre', () => {
    assert.equal(policy.normalizeUnique('Ana', () => false), 'Ana');
  });

  it('agrega un número si el nombre ya está en uso', () => {
    const taken = new Set(['Ana', 'Ana (2)']);
    assert.equal(policy.normalizeUnique('Ana', (name) => taken.has(name)), 'Ana (3)');
  });

  it('recorta el nombre para que el número quepa en el máximo', () => {
    const name = policy.normalizeUnique('Jhanina', (candidate) => candidate === 'Jhanina');
    assert.equal(name, 'Jhan (2)');
    assert.equal(name.length, 8);
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

  it('crea un mensaje inmutable a partir de una solicitud válida', () => {
    const draft = factory.create(author, { clientMessageId: CLIENT_ID.toUpperCase(), text: '  Hola  ' });
    assert.equal(draft.clientMessageId, CLIENT_ID);
    assert.deepEqual(draft.message, {
      id: 'mensaje-1',
      authorId: 'socket-1',
      author: 'Ana',
      text: 'Hola',
      sentAt: fixedDate.toISOString(),
    });
    assert.equal(Object.isFrozen(draft), true);
    assert.equal(Object.isFrozen(draft.message), true);
  });

  it('recorta mensajes largos', () => {
    assert.equal(factory.create(author, { clientMessageId: CLIENT_ID, text: 'a'.repeat(50) }).message.text.length, 10);
  });

  it('rechaza solicitudes inválidas', () => {
    const invalidRequests = [
      'texto suelto',
      null,
      { text: 'sin id' },
      { clientMessageId: 'no-es-uuid', text: 'hola' },
      { clientMessageId: 123, text: 'hola' },
      { clientMessageId: CLIENT_ID, text: '   ' },
      { clientMessageId: CLIENT_ID, text: { html: '<b>' } },
    ];
    for (const request of invalidRequests) {
      assert.equal(factory.create(author, request), null);
    }
  });
});

describe('UserDirectory', () => {
  it('agrega, consulta y quita usuarios sin copiar campos extra', () => {
    const directory = new UserDirectory();
    directory.add({ id: 'a', name: 'Ana', secret: 'no se copia' });
    directory.add({ id: 'b', name: 'Luis' });
    assert.equal(directory.size, 2);
    assert.equal(directory.has('a'), true);
    assert.deepEqual(directory.list(), [
      { id: 'a', name: 'Ana' },
      { id: 'b', name: 'Luis' },
    ]);
    directory.remove('a');
    directory.remove('no-existe');
    assert.equal(directory.has('a'), false);
    assert.deepEqual(directory.list(), [{ id: 'b', name: 'Luis' }]);
  });

  it('compara nombres sin importar mayúsculas ni letras de ancho completo', () => {
    const directory = new UserDirectory();
    directory.add({ id: 'a', name: 'Ana' });
    assert.equal(directory.isNameTaken('ANA'), true);
    assert.equal(directory.isNameTaken(FULLWIDTH_ANA), true);
    assert.equal(directory.isNameTaken('Luis'), false);
    directory.remove('a');
    assert.equal(directory.isNameTaken('Ana'), false);
  });
});

describe('ChatNotices', () => {
  it('arma los avisos de entrada y salida', () => {
    const notices = new ChatNotices();
    assert.equal(notices.joined('Ana'), 'Ana entró al chat');
    assert.equal(notices.left('Ana'), 'Ana salió del chat');
  });
});
