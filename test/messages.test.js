import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_NAME, MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '../src/config.js';
import { MessageHistory, cleanName, cleanText, createMessage } from '../src/messages.js';

describe('cleanText', () => {
  it('quita espacios y caracteres de control', () => {
    assert.equal(cleanText('  hola\u0007 mundo\u007F  ', 100), 'hola mundo');
  });

  it('quita caracteres que invierten la dirección del texto', () => {
    assert.equal(cleanText('Ana‮txt⁦', 100), 'Anatxt');
  });

  it('recorta al tamaño máximo', () => {
    assert.equal(cleanText('abcdef', 3), 'abc');
  });

  it('no parte emojis al recortar', () => {
    assert.equal(cleanText('ab\u{1F44D}\u{1F3FD}cd', 3), 'ab\u{1F44D}\u{1F3FD}');
  });

  it('no deja espacios al final después de recortar', () => {
    assert.equal(cleanText('ab cd', 3), 'ab');
  });

  it('devuelve vacío si no es texto', () => {
    assert.equal(cleanText(42, 10), '');
    assert.equal(cleanText(undefined, 10), '');
    assert.equal(cleanText({ text: 'hola' }, 10), '');
  });
});

describe('cleanName', () => {
  it('usa el nombre por defecto cuando está vacío', () => {
    assert.equal(cleanName('   '), DEFAULT_NAME);
    assert.equal(cleanName(null), DEFAULT_NAME);
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

  it('rechaza mensajes vacíos o que no son texto', () => {
    assert.equal(createMessage('Ana', '   '), null);
    assert.equal(createMessage('Ana', null), null);
    assert.equal(createMessage('Ana', ['hola']), null);
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

  it('rechaza límites inválidos', () => {
    assert.throws(() => new MessageHistory(0), RangeError);
    assert.throws(() => new MessageHistory(1.5), RangeError);
  });
});
