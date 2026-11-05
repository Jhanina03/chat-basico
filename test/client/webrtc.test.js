import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CALL_EVENTS } from '../../shared/protocol.js';
import { CallSignaling } from '../../public/js/call-signaling.js';
import { LocalMediaProvider, MediaAccessError } from '../../public/js/local-media-provider.js';
import { PeerSession } from '../../public/js/peer-session.js';
import { FakeSocket } from '../support/fake-socket.js';

/** Conexión WebRTC falsa que registra las operaciones realizadas. */
class FakePeerConnection extends EventTarget {
  constructor() {
    super();
    this.operations = [];
    this.connectionState = 'new';
    this.localDescription = null;
  }

  addTrack(track) {
    this.operations.push(`track:${track.kind}`);
  }

  async createOffer() {
    return { type: 'offer', sdp: 'sdp-oferta' };
  }

  async createAnswer() {
    return { type: 'answer', sdp: 'sdp-respuesta' };
  }

  async setLocalDescription(description) {
    this.localDescription = { ...description, toJSON: () => description };
  }

  async setRemoteDescription(description) {
    this.operations.push(`remota:${description.type}`);
  }

  async addIceCandidate(candidate) {
    this.operations.push(`candidato:${candidate.candidate}`);
  }

  close() {
    this.operations.push('cerrada');
  }

  emitEvent(type, properties) {
    this.dispatchEvent(Object.assign(new Event(type), properties));
  }
}

function createStream() {
  const tracks = [
    { kind: 'audio', stopped: false, stop() { this.stopped = true; } },
    { kind: 'video', stopped: false, stop() { this.stopped = true; } },
  ];
  return { tracks, getTracks: () => tracks };
}

function createPeerSession() {
  const connection = new FakePeerConnection();
  const events = { candidates: [], streams: [], failures: 0 };
  const session = new PeerSession({
    createConnection: () => connection,
    onCandidate: (candidate) => events.candidates.push(candidate),
    onRemoteStream: (stream) => events.streams.push(stream),
    onFailure: () => {
      events.failures += 1;
    },
  });
  return { connection, events, session };
}

describe('CallSignaling', () => {
  it('envía cada señal con el evento correcto', () => {
    const socket = new FakeSocket();
    const signaling = new CallSignaling(socket);
    signaling.sendOffer('b', { type: 'offer' });
    signaling.sendAnswer('b', { type: 'answer' });
    signaling.sendCandidate('b', { candidate: 'c' });
    signaling.sendReject('b', 'busy');
    signaling.sendEnd('b');
    assert.deepEqual(socket.sent, [
      { event: CALL_EVENTS.offer, payload: { to: 'b', description: { type: 'offer' } } },
      { event: CALL_EVENTS.answer, payload: { to: 'b', description: { type: 'answer' } } },
      { event: CALL_EVENTS.candidate, payload: { to: 'b', candidate: { candidate: 'c' } } },
      { event: CALL_EVENTS.reject, payload: { to: 'b', reason: 'busy' } },
      { event: CALL_EVENTS.end, payload: { to: 'b' } },
    ]);
  });

  it('entrega cada señal recibida a su manejador', async () => {
    const socket = new FakeSocket();
    const received = [];
    new CallSignaling(socket).subscribe({
      onOffer: () => received.push('oferta'),
      onAnswer: () => received.push('respuesta'),
      onCandidate: () => received.push('candidato'),
      onReject: () => received.push('rechazo'),
      onEnd: () => received.push('fin'),
    });
    for (const event of Object.values(CALL_EVENTS)) {
      await socket.receive(event, {});
    }
    assert.deepEqual(received, ['oferta', 'respuesta', 'candidato', 'rechazo', 'fin']);
  });
});

describe('LocalMediaProvider', () => {
  it('abre la cámara y el micrófono', async () => {
    const stream = createStream();
    const requested = [];
    const provider = new LocalMediaProvider({
      getUserMedia: async (constraints) => {
        requested.push(constraints);
        return stream;
      },
    });
    assert.equal(await provider.open(), stream);
    assert.deepEqual(requested, [{ video: true, audio: true }]);
  });

  it('explica cuando el navegador no permite videollamadas', async () => {
    await assert.rejects(new LocalMediaProvider(undefined).open(), {
      name: 'MediaAccessError',
      message: /se necesita HTTPS/,
    });
  });

  it('traduce los errores del navegador a mensajes claros', async () => {
    const cases = [
      ['NotAllowedError', /No diste permiso/],
      ['NotFoundError', /No se encontró cámara/],
      ['NotReadableError', /otra aplicación/],
      ['ErrorDesconocido', /No se pudo abrir la cámara/],
    ];
    for (const [name, message] of cases) {
      const browserError = Object.assign(new Error('fallo'), { name });
      const provider = new LocalMediaProvider({
        getUserMedia: async () => {
          throw browserError;
        },
      });
      await assert.rejects(provider.open(), (error) => {
        assert.ok(error instanceof MediaAccessError);
        assert.match(error.message, message);
        assert.equal(error.cause, browserError);
        return true;
      });
    }
  });

  it('apaga todas las pistas y tolera la ausencia de video', () => {
    const stream = createStream();
    const provider = new LocalMediaProvider({});
    provider.release(stream);
    provider.release(null);
    assert.ok(stream.tracks.every((track) => track.stopped));
  });
});

describe('PeerSession', () => {
  it('crea una oferta con las pistas locales', async () => {
    const { connection, session } = createPeerSession();
    session.addLocalStream(createStream());
    const offer = await session.createOffer();
    assert.deepEqual(offer, { type: 'offer', sdp: 'sdp-oferta' });
    assert.deepEqual(connection.operations, ['track:audio', 'track:video']);
  });

  it('guarda los candidatos que llegan antes de la oferta y los aplica después', async () => {
    const { connection, session } = createPeerSession();
    await session.addCandidate({ candidate: 'temprano' });
    assert.deepEqual(connection.operations, []);
    const answer = await session.acceptOffer({ type: 'offer', sdp: 'x' });
    await session.addCandidate({ candidate: 'tarde' });
    assert.deepEqual(answer, { type: 'answer', sdp: 'sdp-respuesta' });
    assert.deepEqual(connection.operations, ['remota:offer', 'candidato:temprano', 'candidato:tarde']);
  });

  it('acepta la respuesta de quien contesta', async () => {
    const { connection, session } = createPeerSession();
    await session.acceptAnswer({ type: 'answer', sdp: 'x' });
    assert.deepEqual(connection.operations, ['remota:answer']);
  });

  it('avisa candidatos propios, video remoto y fallas de conexión', () => {
    const { connection, events } = createPeerSession();
    const remoteStream = createStream();
    connection.emitEvent('icecandidate', { candidate: { toJSON: () => ({ candidate: 'propio' }) } });
    connection.emitEvent('icecandidate', { candidate: null });
    connection.emitEvent('track', { streams: [remoteStream] });
    connection.connectionState = 'connected';
    connection.emitEvent('connectionstatechange');
    connection.connectionState = 'failed';
    connection.emitEvent('connectionstatechange');
    assert.deepEqual(events.candidates, [{ candidate: 'propio' }]);
    assert.deepEqual(events.streams, [remoteStream]);
    assert.equal(events.failures, 1);
  });

  it('cierra la conexión', () => {
    const { connection, session } = createPeerSession();
    session.close();
    assert.deepEqual(connection.operations, ['cerrada']);
  });
});
