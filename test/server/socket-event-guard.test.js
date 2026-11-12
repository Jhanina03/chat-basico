import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACK_STATUS, CHAT_EVENTS, REJECTION_REASONS } from '../../shared/protocol.js';
import { ChatMetrics } from '../../src/observability/chat-metrics.js';
import { rejection, toReply } from '../../src/realtime/acknowledgement.js';
import { SocketEventGuard } from '../../src/realtime/socket-event-guard.js';
import { FakeSocket } from '../support/fake-socket.js';
import { createLogRecorder } from '../support/log-recorder.js';

describe('acknowledgement', () => {
  it('usa la función de confirmación si existe y una vacía si no', () => {
    const responses = [];
    toReply((response) => responses.push(response))({ status: 'ok' });
    assert.deepEqual(responses, [{ status: 'ok' }]);
    assert.doesNotThrow(() => toReply(undefined)({ status: 'ok' }));
    assert.doesNotThrow(() => toReply('no es función')({ status: 'ok' }));
  });

  it('arma rechazos con estado y motivo', () => {
    assert.deepEqual(rejection(REJECTION_REASONS.invalid), { status: ACK_STATUS.rejected, reason: 'invalid' });
  });
});

describe('SocketEventGuard', () => {
  function setup() {
    const recorder = createLogRecorder();
    const metrics = new ChatMetrics();
    const guard = new SocketEventGuard({ logger: recorder.logger, metrics });
    const socket = new FakeSocket('conexion-1');
    return { ...recorder, metrics, guard, socket };
  }

  it('ejecuta el manejador normalmente cuando no falla', async () => {
    const { guard, socket, entries } = setup();
    const received = [];
    guard.on(socket, 'evento', (payload) => received.push(payload));
    await socket.receive('evento', 'dato');
    assert.deepEqual(received, ['dato']);
    assert.deepEqual(entries, []);
  });

  it('si el manejador falla: registra, cuenta, avisa y responde el ack con error', async () => {
    const { guard, socket, entries, metrics } = setup();
    guard.on(socket, CHAT_EVENTS.message, () => {
      throw new Error('base de datos caída');
    });
    const responses = [];

    await socket.receive(CHAT_EVENTS.message, { text: 'hola' }, (response) => responses.push(response));

    assert.equal(entries[0].event, 'socket_handler_failed');
    assert.equal(entries[0].connectionId, 'conexion-1');
    assert.equal(entries[0].socketEvent, CHAT_EVENTS.message);
    assert.equal(entries[0].error.message, 'base de datos caída');
    assert.equal(metrics.value('errors_total', { source: 'socket' }), 1);
    assert.deepEqual(socket.sentPayloads(CHAT_EVENTS.serverError), [undefined]);
    assert.deepEqual(responses, [rejection(REJECTION_REASONS.serverError)]);
  });

  it('si el manejador falla sin ack: solo registra y avisa', async () => {
    const { guard, socket, entries } = setup();
    guard.on(socket, 'disconnect', () => {
      throw new Error('fallo al salir');
    });
    await socket.receive('disconnect', 'transport close');
    assert.equal(entries.length, 1);
    assert.equal(socket.sentPayloads(CHAT_EVENTS.serverError).length, 1);
  });
});
