import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACK_STATUS, CHAT_EVENTS, REJECTION_REASONS } from '../../shared/protocol.js';
import { ChatTexts, SEND_TIMEOUT } from '../../public/js/chat-texts.js';
import { MessageSender } from '../../public/js/message-sender.js';
import { FakeSocket } from '../support/fake-socket.js';

const TIMEOUT_ERROR = new Error('operation has timed out');

describe('MessageSender', () => {
  let socket;
  let problems;
  let sender;
  let generatedIds;

  beforeEach(() => {
    socket = new FakeSocket();
    problems = [];
    generatedIds = 0;
    sender = new MessageSender({
      socket,
      createId: () => {
        generatedIds += 1;
        return `id-${generatedIds}`;
      },
      timeoutMs: 5000,
      maxAttempts: 2,
      onProblem: (reason) => problems.push(reason),
    });
  });

  it('envía el texto con un identificador y espera la confirmación', () => {
    sender.send('Hola');
    assert.deepEqual(socket.sentPayloads(CHAT_EVENTS.message), [{ clientMessageId: 'id-1', text: 'Hola' }]);
    assert.deepEqual(socket.timeouts, [5000]);
    socket.acknowledgeLast(CHAT_EVENTS.message, null, { status: ACK_STATUS.accepted, id: 'm1' });
    assert.deepEqual(problems, []);
  });

  it('no avisa nada si el servidor reconoce un reintento ya guardado', () => {
    sender.send('Hola');
    socket.acknowledgeLast(CHAT_EVENTS.message, null, { status: ACK_STATUS.duplicate });
    assert.deepEqual(problems, []);
  });

  it('avisa el motivo cuando el servidor rechaza el mensaje', () => {
    sender.send('Hola');
    socket.acknowledgeLast(CHAT_EVENTS.message, null, {
      status: ACK_STATUS.rejected,
      reason: REJECTION_REASONS.rateLimited,
    });
    assert.deepEqual(problems, [REJECTION_REASONS.rateLimited]);
  });

  it('reintenta con el mismo identificador si no llega la confirmación', () => {
    sender.send('Hola');
    socket.acknowledgeLast(CHAT_EVENTS.message, TIMEOUT_ERROR);
    const attempts = socket.sentPayloads(CHAT_EVENTS.message);
    assert.equal(attempts.length, 2);
    assert.equal(attempts[0].clientMessageId, attempts[1].clientMessageId);
    assert.equal(generatedIds, 1);
    socket.acknowledgeLast(CHAT_EVENTS.message, null, { status: ACK_STATUS.accepted, id: 'm1' });
    assert.deepEqual(problems, []);
  });

  it('se rinde y avisa después del último intento', () => {
    sender.send('Hola');
    socket.acknowledgeLast(CHAT_EVENTS.message, TIMEOUT_ERROR);
    socket.acknowledgeLast(CHAT_EVENTS.message, TIMEOUT_ERROR);
    assert.equal(socket.sentPayloads(CHAT_EVENTS.message).length, 2);
    assert.deepEqual(problems, [SEND_TIMEOUT]);
  });

  it('usa un identificador nuevo para cada mensaje distinto', () => {
    sender.send('Uno');
    sender.send('Dos');
    const ids = socket.sentPayloads(CHAT_EVENTS.message).map((payload) => payload.clientMessageId);
    assert.deepEqual(ids, ['id-1', 'id-2']);
  });
});

describe('ChatTexts', () => {
  const texts = new ChatTexts();

  it('tiene un texto claro para cada motivo de problema', () => {
    for (const reason of [...Object.values(REJECTION_REASONS), SEND_TIMEOUT]) {
      assert.notEqual(texts.problem(reason), 'No se pudo completar la acción.', reason);
    }
  });

  it('usa un texto general para motivos desconocidos', () => {
    assert.equal(texts.problem('desconocido'), 'No se pudo completar la acción.');
    assert.equal(texts.problem(undefined), 'No se pudo completar la acción.');
  });

  it('describe el estado de la conexión', () => {
    assert.equal(texts.online(), 'En línea');
    assert.equal(texts.offline(), 'Desconectado');
  });
});
