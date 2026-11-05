import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CALL_EVENTS, REJECT_REASONS } from '../../shared/protocol.js';
import { CALL_STATES, CallCoordinator } from '../../public/js/call-coordinator.js';
import { CallMessages } from '../../public/js/call-messages.js';
import { CallSignaling } from '../../public/js/call-signaling.js';
import { MediaAccessError } from '../../public/js/local-media-provider.js';
import { FakeSocket } from '../support/fake-socket.js';

const LUIS = { id: 'luis', name: 'Luis' };
const OFFER = { type: 'offer', sdp: 'oferta' };
const ANSWER = { type: 'answer', sdp: 'respuesta' };

class RecordingCallView {
  constructor() {
    this.events = [];
    this.handlers = {};
  }

  onAccept(handler) {
    this.handlers.accept = handler;
  }

  onReject(handler) {
    this.handlers.reject = handler;
  }

  onHangUp(handler) {
    this.handlers.hangUp = handler;
  }

  showIncoming(name) {
    this.events.push(`entrante:${name}`);
  }

  hideIncoming() {
    this.events.push('ocultar-entrante');
  }

  showCall(text) {
    this.events.push(`llamada:${text}`);
  }

  setStatus(text) {
    this.events.push(`estado:${text}`);
  }

  showLocalStream() {
    this.events.push('video-local');
  }

  showRemoteStream() {
    this.events.push('video-remoto');
  }

  hideCall() {
    this.events.push('ocultar-llamada');
  }
}

class ControllableMedia {
  constructor() {
    this.stream = { id: 'camara' };
    this.released = [];
    this.error = null;
    this.pendingOpen = null;
  }

  open() {
    if (this.error !== null) {
      return Promise.reject(this.error);
    }
    if (this.pendingOpen !== null) {
      return this.pendingOpen.promise;
    }
    return Promise.resolve(this.stream);
  }

  holdOpen() {
    this.pendingOpen = Promise.withResolvers();
  }

  release(stream) {
    this.released.push(stream);
  }
}

class RecordingPeerSession {
  constructor(handlers) {
    this.handlers = handlers;
    this.operations = [];
    this.failure = null;
  }

  addLocalStream() {
    this.operations.push('stream-local');
  }

  async createOffer() {
    this.#throwIfFailing();
    return OFFER;
  }

  async acceptOffer(offer) {
    this.#throwIfFailing();
    this.operations.push(`oferta:${offer.sdp}`);
    return ANSWER;
  }

  async acceptAnswer(answer) {
    this.#throwIfFailing();
    this.operations.push(`respuesta:${answer.sdp}`);
  }

  async addCandidate(candidate) {
    this.#throwIfFailing();
    this.operations.push(`candidato:${candidate.candidate}`);
  }

  close() {
    this.operations.push('cerrada');
  }

  #throwIfFailing() {
    if (this.failure !== null) {
      throw this.failure;
    }
  }
}

describe('CallCoordinator', () => {
  let socket;
  let view;
  let media;
  let sessions;
  let notices;
  let busyChanges;
  let warnings;
  let coordinator;

  beforeEach(() => {
    socket = new FakeSocket('yo');
    view = new RecordingCallView();
    media = new ControllableMedia();
    sessions = [];
    notices = [];
    busyChanges = [];
    warnings = [];
    coordinator = createCoordinator();
    coordinator.start();
  });

  function createCoordinator({ sessionFailure = null } = {}) {
    return new CallCoordinator({
      signaling: new CallSignaling(socket),
      view,
      messages: new CallMessages(),
      media,
      createPeerSession: (handlers) => {
        const session = new RecordingPeerSession(handlers);
        session.failure = sessionFailure;
        sessions.push(session);
        return session;
      },
      notify: (text) => notices.push(text),
      onBusyChange: (busy) => busyChanges.push(busy),
      logger: { warn: (text) => warnings.push(text) },
    });
  }

  function receiveOffer(from = LUIS) {
    return socket.receive(CALL_EVENTS.offer, { from: from.id, fromName: from.name, description: OFFER });
  }

  describe('al llamar', () => {
    it('abre la cámara, crea la conexión y envía la oferta', async () => {
      await coordinator.call(LUIS);
      assert.equal(coordinator.state, CALL_STATES.calling);
      assert.deepEqual(view.events, ['llamada:Llamando a Luis…', 'video-local']);
      assert.deepEqual(sessions[0].operations, ['stream-local']);
      assert.deepEqual(socket.sentPayloads(CALL_EVENTS.offer), [{ to: 'luis', description: OFFER }]);
      assert.deepEqual(busyChanges, [true]);
    });

    it('queda en llamada cuando la otra persona contesta', async () => {
      await coordinator.call(LUIS);
      await socket.receive(CALL_EVENTS.answer, { from: 'otra-persona', description: ANSWER });
      assert.equal(coordinator.state, CALL_STATES.calling);
      await socket.receive(CALL_EVENTS.answer, { from: 'luis', description: ANSWER });
      assert.equal(coordinator.state, CALL_STATES.active);
      assert.equal(view.events.at(-1), 'estado:En llamada con Luis');
    });

    it('envía sus candidatos y muestra el video remoto', async () => {
      await coordinator.call(LUIS);
      sessions[0].handlers.onCandidate({ candidate: 'propio' });
      sessions[0].handlers.onRemoteStream({ id: 'remoto' });
      assert.deepEqual(socket.sentPayloads(CALL_EVENTS.candidate), [{ to: 'luis', candidate: { candidate: 'propio' } }]);
      assert.equal(view.events.at(-1), 'video-remoto');
    });

    it('ignora otra llamada mientras ya está llamando', async () => {
      await coordinator.call(LUIS);
      await coordinator.call({ id: 'ana', name: 'Ana' });
      assert.equal(socket.sentPayloads(CALL_EVENTS.offer).length, 1);
    });

    it('explica el problema si no hay permiso de cámara', async () => {
      media.error = new MediaAccessError('No diste permiso para usar la cámara o el micrófono.');
      await coordinator.call(LUIS);
      assert.equal(coordinator.state, CALL_STATES.idle);
      assert.deepEqual(notices, ['No diste permiso para usar la cámara o el micrófono.']);
      assert.deepEqual(busyChanges, [true, false]);
    });

    it('muestra un mensaje general ante errores inesperados', async () => {
      const failingCoordinator = createCoordinator({ sessionFailure: new Error('fallo interno') });
      await failingCoordinator.call(LUIS);
      assert.equal(failingCoordinator.state, CALL_STATES.idle);
      assert.deepEqual(notices, ['No se pudo completar la videollamada.']);
      assert.deepEqual(warnings, ['La videollamada falló']);
    });

    it('termina si falla la respuesta recibida', async () => {
      await coordinator.call(LUIS);
      sessions[0].failure = new Error('respuesta corrupta');
      await socket.receive(CALL_EVENTS.answer, { from: 'luis', description: ANSWER });
      assert.equal(coordinator.state, CALL_STATES.idle);
      assert.deepEqual(socket.sentPayloads(CALL_EVENTS.end), [{ to: 'luis' }]);
      assert.deepEqual(notices, ['No se pudo completar la videollamada.']);
    });

    it('libera la cámara si se cuelga antes de que se abra', async () => {
      media.holdOpen();
      const calling = coordinator.call(LUIS);
      coordinator.hangUp();
      media.pendingOpen.resolve(media.stream);
      await calling;
      assert.deepEqual(media.released, [null, media.stream]);
      assert.equal(sessions.length, 0);
      assert.deepEqual(socket.sentPayloads(CALL_EVENTS.offer), []);
    });
  });

  describe('al recibir una llamada', () => {
    it('muestra el aviso y contesta con la respuesta', async () => {
      await receiveOffer();
      assert.equal(coordinator.state, CALL_STATES.ringing);
      assert.deepEqual(view.events, ['entrante:Luis']);

      await socket.receive(CALL_EVENTS.candidate, { from: 'luis', candidate: { candidate: 'temprano' } });
      await coordinator.acceptIncoming();

      assert.equal(coordinator.state, CALL_STATES.active);
      assert.deepEqual(sessions[0].operations, ['stream-local', 'candidato:temprano', 'oferta:oferta']);
      assert.deepEqual(socket.sentPayloads(CALL_EVENTS.answer), [{ to: 'luis', description: ANSWER }]);
      assert.equal(view.events.at(-1), 'estado:En llamada con Luis');
    });

    it('aplica candidatos que llegan durante la llamada e ignora los de otras personas', async () => {
      await receiveOffer();
      await coordinator.acceptIncoming();
      await socket.receive(CALL_EVENTS.candidate, { from: 'luis', candidate: { candidate: 'durante' } });
      await socket.receive(CALL_EVENTS.candidate, { from: 'otra', candidate: { candidate: 'ajeno' } });
      assert.equal(sessions[0].operations.at(-1), 'candidato:durante');
    });

    it('registra y descarta candidatos inválidos', async () => {
      await receiveOffer();
      await coordinator.acceptIncoming();
      sessions[0].failure = new Error('candidato inválido');
      await socket.receive(CALL_EVENTS.candidate, { from: 'luis', candidate: { candidate: 'malo' } });
      assert.deepEqual(warnings, ['Se descartó un candidato de conexión inválido']);
      assert.equal(coordinator.state, CALL_STATES.active);
    });

    it('responde ocupado si ya hay una llamada', async () => {
      await coordinator.call(LUIS);
      await receiveOffer({ id: 'ana', name: 'Ana' });
      assert.deepEqual(socket.sentPayloads(CALL_EVENTS.reject), [{ to: 'ana', reason: REJECT_REASONS.busy }]);
    });

    it('rechaza sin mostrar avisos', async () => {
      await receiveOffer();
      view.handlers.reject();
      assert.equal(coordinator.state, CALL_STATES.idle);
      assert.deepEqual(socket.sentPayloads(CALL_EVENTS.reject), [{ to: 'luis', reason: REJECT_REASONS.rejected }]);
      assert.deepEqual(notices, []);
    });

    it('avisa a quien llama si no se pudo abrir la cámara', async () => {
      await receiveOffer();
      media.error = new MediaAccessError('No se encontró cámara o micrófono.');
      await coordinator.acceptIncoming();
      assert.deepEqual(socket.sentPayloads(CALL_EVENTS.reject), [{ to: 'luis', reason: REJECT_REASONS.unavailable }]);
      assert.deepEqual(notices, ['No se encontró cámara o micrófono.']);
    });

    it('muestra llamada perdida si la otra persona cuelga antes de contestar', async () => {
      await receiveOffer();
      await socket.receive(CALL_EVENTS.end, { from: 'luis' });
      assert.deepEqual(notices, ['Llamada perdida de Luis.']);
    });

    it('no contesta si se cuelga mientras se abre la cámara', async () => {
      await receiveOffer();
      media.holdOpen();
      const accepting = coordinator.acceptIncoming();
      coordinator.hangUp();
      media.pendingOpen.resolve(media.stream);
      await accepting;
      assert.deepEqual(socket.sentPayloads(CALL_EVENTS.answer), []);
      assert.equal(media.released.at(-1), media.stream);
    });

    it('no avisa errores de una llamada que ya terminó', async () => {
      await receiveOffer();
      media.holdOpen();
      const accepting = coordinator.acceptIncoming();
      coordinator.hangUp();
      media.pendingOpen.reject(new MediaAccessError('No se encontró cámara o micrófono.'));
      await accepting;
      assert.deepEqual(socket.sentPayloads(CALL_EVENTS.reject), []);
      assert.deepEqual(notices, ['Llamada finalizada.']);
    });

    it('se contesta desde el botón de la vista', async () => {
      await receiveOffer();
      await view.handlers.accept();
      assert.equal(socket.sentPayloads(CALL_EVENTS.answer).length, 1);
    });
  });

  describe('al terminar', () => {
    it('cuelga, avisa a la otra persona y libera todo', async () => {
      await coordinator.call(LUIS);
      view.handlers.hangUp();
      assert.equal(coordinator.state, CALL_STATES.idle);
      assert.deepEqual(socket.sentPayloads(CALL_EVENTS.end), [{ to: 'luis' }]);
      assert.deepEqual(media.released, [media.stream]);
      assert.equal(sessions[0].operations.at(-1), 'cerrada');
      assert.deepEqual(notices, ['Llamada finalizada.']);
      assert.deepEqual(busyChanges, [true, false]);
    });

    it('explica cada motivo de rechazo', async () => {
      const cases = [
        [REJECT_REASONS.busy, 'Luis está en otra llamada.'],
        [REJECT_REASONS.unavailable, 'Luis no pudo contestar.'],
        [REJECT_REASONS.rejected, 'Luis rechazó la llamada.'],
        ['desconocido', 'Luis rechazó la llamada.'],
      ];
      for (const [reason, message] of cases) {
        await coordinator.call(LUIS);
        await socket.receive(CALL_EVENTS.reject, { from: 'ana', reason });
        await socket.receive(CALL_EVENTS.reject, { from: 'luis', reason });
        assert.equal(notices.at(-1), message);
      }
    });

    it('avisa cuando la otra persona cuelga una llamada activa', async () => {
      await coordinator.call(LUIS);
      await socket.receive(CALL_EVENTS.answer, { from: 'luis', description: ANSWER });
      await socket.receive(CALL_EVENTS.end, { from: 'ana' });
      await socket.receive(CALL_EVENTS.end, { from: 'luis' });
      assert.deepEqual(notices, ['La llamada terminó.']);
    });

    it('termina si se pierde la conexión', async () => {
      await coordinator.call(LUIS);
      sessions[0].handlers.onFailure();
      assert.deepEqual(notices, ['Se perdió la conexión de la videollamada.']);
    });

    it('termina si la otra persona sale del chat', async () => {
      await coordinator.call(LUIS);
      coordinator.handleUsersChanged([LUIS]);
      assert.equal(coordinator.state, CALL_STATES.calling);
      coordinator.handleUsersChanged([{ id: 'yo', name: 'Jhanina' }]);
      assert.deepEqual(notices, ['Luis se desconectó.']);
    });

    it('no hace nada si no hay llamada', async () => {
      coordinator.hangUp();
      coordinator.rejectIncoming();
      await coordinator.acceptIncoming();
      coordinator.handleUsersChanged([]);
      await socket.receive(CALL_EVENTS.answer, { from: 'luis', description: ANSWER });
      assert.deepEqual(socket.sent, []);
      assert.deepEqual(notices, []);
    });
  });
});
