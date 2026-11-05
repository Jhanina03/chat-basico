import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CALL_EVENTS, REJECT_REASONS } from '../../shared/protocol.js';
import { CallSignalValidator } from '../../src/domain/call-signal-validator.js';

const validator = new CallSignalValidator({ sdpLength: 100, iceCandidateLength: 50 });

describe('CallSignalValidator', () => {
  it('conoce todos los eventos de videollamada', () => {
    assert.deepEqual(validator.events.toSorted(), Object.values(CALL_EVENTS).toSorted());
  });

  it('acepta una oferta válida y quita campos extra', () => {
    const signal = { to: 'b', description: { type: 'offer', sdp: 'v=0', extra: 'x' }, extra: true };
    assert.deepEqual(validator.parse(CALL_EVENTS.offer, signal), { description: { type: 'offer', sdp: 'v=0' } });
  });

  it('acepta una respuesta válida', () => {
    const signal = { description: { type: 'answer', sdp: 'v=0' } };
    assert.deepEqual(validator.parse(CALL_EVENTS.answer, signal), { description: { type: 'answer', sdp: 'v=0' } });
  });

  it('rechaza descripciones inválidas', () => {
    const invalidDescriptions = [
      undefined,
      'texto',
      { type: 'answer', sdp: 'v=0' },
      { type: 'offer', sdp: '' },
      { type: 'offer', sdp: 42 },
      { type: 'offer', sdp: 'x'.repeat(101) },
    ];
    for (const description of invalidDescriptions) {
      assert.equal(validator.parse(CALL_EVENTS.offer, { description }), null);
    }
  });

  it('acepta candidatos válidos y completa campos opcionales', () => {
    const signal = { candidate: { candidate: 'candidate:1 1 udp', extra: 'x' } };
    assert.deepEqual(validator.parse(CALL_EVENTS.candidate, signal), {
      candidate: { candidate: 'candidate:1 1 udp', sdpMid: null, sdpMLineIndex: null },
    });
    const complete = { candidate: { candidate: 'c', sdpMid: '0', sdpMLineIndex: 0 } };
    assert.deepEqual(validator.parse(CALL_EVENTS.candidate, complete), complete);
  });

  it('rechaza candidatos inválidos', () => {
    const invalidCandidates = [
      null,
      { candidate: 5 },
      { candidate: 'x'.repeat(51) },
      { candidate: 'c', sdpMid: 3 },
      { candidate: 'c', sdpMLineIndex: -1 },
      { candidate: 'c', sdpMLineIndex: 'cero' },
    ];
    for (const candidate of invalidCandidates) {
      assert.equal(validator.parse(CALL_EVENTS.candidate, { candidate }), null);
    }
  });

  it('solo reenvía motivos de rechazo conocidos', () => {
    assert.deepEqual(validator.parse(CALL_EVENTS.reject, { reason: REJECT_REASONS.busy }), { reason: 'busy' });
    assert.deepEqual(validator.parse(CALL_EVENTS.reject, { reason: '<script>' }), { reason: 'rejected' });
  });

  it('acepta el fin de llamada sin datos', () => {
    assert.deepEqual(validator.parse(CALL_EVENTS.end, { to: 'b' }), {});
  });

  it('rechaza eventos desconocidos y señales que no son objetos', () => {
    assert.equal(validator.parse('call:hack', {}), null);
    assert.equal(validator.parse(CALL_EVENTS.end, 'texto'), null);
    assert.equal(validator.parse(CALL_EVENTS.end, ['lista']), null);
  });
});
