import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  MessageHistory,
  cleanName,
  cleanText,
  createMessage,
} from '../src/messages.js';

describe('cleanText', () => {
  it('quita espacios y caracteres de control', () => {
    assert.equal(cleanText('  hola\u0007 mundo\u007F  ', 100), 'hola mundo');
  });

  it('recorta al tamaño máximo', () => {
    assert.equal(cleanText('abcdef', 3), 'abc');
  });

  it('devuelve vacío si no es texto', () => {
    assert.equal(cleanText(42, 10), '');
    assert.equal(cleanText(undefined, 10), '');
  });
});

describe('cleanName', () => {
  it('usa Anónimo cuando el nombre está vacío', () => {
    assert.equal(cleanName('   '), 'Anónimo');
  });

  it('limita la longitud del nombre', () => {
    assert.equal(cleanName('x'.repeat(100)).length, MAX_NAME_LENGTH);
  });
});

describe('createMessage', () => {
  it('crea un mensaje con autor, texto y fecha', () => {
    const now = new Date('2026-01-01T10:00:00.000Z');
    const message = createMessage('Ana', ' Hola ', now);
    assert.equal(message.author, 'Ana');
    assert.equal(message.text, 'Hola');
    assert.equal(message.sentAt, now.toISOString());
    assert.match(message.id, /^[\da-f-]{36}$/);
  });

  it('rechaza mensajes vacíos', () => {
    assert.equal(createMessage('Ana', '   '), null);
    assert.equal(createMessage('Ana', null), null);
  });

  it('recorta mensajes muy largos', () => {
    const message = createMessage('Ana', 'a'.repeat(MAX_TEXT_LENGTH + 10));
    assert.equal(message.text.length, MAX_TEXT_LENGTH);
  });
});

describe('MessageHistory', () => {
  it('guarda solo los últimos mensajes', () => {
    const history = new MessageHistory(2);
    history.add({ id: '1' });
    history.add({ id: '2' });
    history.add({ id: '3' });
    assert.deepEqual(history.list().map((item) => item.id), ['2', '3']);
  });

  it('devuelve una copia del historial', () => {
    const history = new MessageHistory();
    history.add({ id: '1' });
    history.list().pop();
    assert.equal(history.list().length, 1);
  });
});
