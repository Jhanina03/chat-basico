import { CALL_REJECT_REASONS } from '../../shared/protocol.js';
import { MediaAccessError } from './local-media-provider.js';

export const CALL_STATES = Object.freeze({
  idle: 'idle',
  calling: 'calling',
  ringing: 'ringing',
  active: 'active',
});

/**
 * Controla el ciclo de una videollamada: llamar, contestar, rechazar y colgar.
 * Solo permite una llamada a la vez.
 */
export class CallCoordinator {
  #signaling;
  #view;
  #messages;
  #media;
  #createPeerSession;
  #notify;
  #onBusyChange;
  #logger;

  #state = CALL_STATES.idle;
  #callNumber = 0;
  #peer = null;
  #session = null;
  #localStream = null;
  #pendingOffer = null;
  #earlyCandidates = [];

  /**
   * @param {{
   *   signaling: import('./call-signaling.js').CallSignaling,
   *   view: import('./call-view.js').CallView,
   *   messages: import('./call-messages.js').CallMessages,
   *   media: import('./local-media-provider.js').LocalMediaProvider,
   *   createPeerSession: (handlers: object) => import('./peer-session.js').PeerSession,
   *   notify: (text: string) => void,
   *   onBusyChange: (busy: boolean) => void,
   *   logger: Pick<Console, 'warn'>,
   * }} dependencies
   */
  constructor({ signaling, view, messages, media, createPeerSession, notify, onBusyChange, logger }) {
    this.#signaling = signaling;
    this.#view = view;
    this.#messages = messages;
    this.#media = media;
    this.#createPeerSession = createPeerSession;
    this.#notify = notify;
    this.#onBusyChange = onBusyChange;
    this.#logger = logger;
  }

  get state() {
    return this.#state;
  }

  start() {
    this.#signaling.subscribe({
      onOffer: (signal) => this.#handleOffer(signal),
      onAnswer: (signal) => this.#handleAnswer(signal),
      onCandidate: (signal) => this.#handleCandidate(signal),
      onReject: (signal) => this.#handleReject(signal),
      onEnd: (signal) => this.#handleEnd(signal),
    });
    this.#view.onAccept(() => this.acceptIncoming());
    this.#view.onReject(() => this.rejectIncoming());
    this.#view.onHangUp(() => this.hangUp());
  }

  /**
   * @param {{ id: string, name: string }} contact persona a quien se llama
   */
  async call(contact) {
    if (this.#state !== CALL_STATES.idle) {
      return;
    }
    const callNumber = this.#begin(CALL_STATES.calling, contact);
    this.#view.showCall(this.#messages.calling(contact.name));
    try {
      if (!(await this.#prepareConnection(callNumber))) {
        return;
      }
      const offer = await this.#session.createOffer();
      if (this.#isCurrent(callNumber)) {
        this.#signaling.sendOffer(contact.id, offer);
      }
    } catch (error) {
      this.#fail(callNumber, error);
    }
  }

  async acceptIncoming() {
    if (this.#state !== CALL_STATES.ringing) {
      return;
    }
    const callNumber = this.#callNumber;
    const peer = this.#peer;
    this.#view.hideIncoming();
    this.#view.showCall(this.#messages.connecting(peer.name));
    try {
      if (!(await this.#prepareConnection(callNumber))) {
        return;
      }
      const answer = await this.#session.acceptOffer(this.#pendingOffer);
      if (this.#isCurrent(callNumber)) {
        this.#signaling.sendAnswer(peer.id, answer);
        this.#activate(peer);
      }
    } catch (error) {
      if (this.#isCurrent(callNumber)) {
        this.#signaling.sendReject(peer.id, CALL_REJECT_REASONS.unavailable);
      }
      this.#fail(callNumber, error);
    }
  }

  rejectIncoming() {
    if (this.#state !== CALL_STATES.ringing) {
      return;
    }
    this.#signaling.sendReject(this.#peer.id, CALL_REJECT_REASONS.rejected);
    this.#finish(null);
  }

  hangUp() {
    if (this.#state === CALL_STATES.idle) {
      return;
    }
    this.#signaling.sendEnd(this.#peer.id);
    this.#finish(this.#messages.hungUp());
  }

  /**
   * Termina la llamada si la otra persona se desconectó del chat.
   * @param {{ id: string }[]} users
   */
  handleUsersChanged(users) {
    if (this.#peer !== null && !users.some((user) => user.id === this.#peer.id)) {
      this.#finish(this.#messages.peerLeft(this.#peer.name));
    }
  }

  #handleOffer({ from, fromName, description }) {
    if (this.#state !== CALL_STATES.idle) {
      this.#signaling.sendReject(from, CALL_REJECT_REASONS.busy);
      return;
    }
    this.#begin(CALL_STATES.ringing, { id: from, name: fromName });
    this.#pendingOffer = description;
    this.#view.showIncoming(fromName);
  }

  async #handleAnswer({ from, description }) {
    if (!this.#isPeer(from) || this.#state !== CALL_STATES.calling || this.#session === null) {
      return;
    }
    const callNumber = this.#callNumber;
    const peer = this.#peer;
    try {
      await this.#session.acceptAnswer(description);
      if (this.#isCurrent(callNumber)) {
        this.#activate(peer);
      }
    } catch (error) {
      this.#signaling.sendEnd(peer.id);
      this.#fail(callNumber, error);
    }
  }

  async #handleCandidate({ from, candidate }) {
    if (!this.#isPeer(from)) {
      return;
    }
    if (this.#session === null) {
      this.#earlyCandidates.push(candidate);
      return;
    }
    try {
      await this.#session.addCandidate(candidate);
    } catch (error) {
      this.#logger.warn('Se descartó un candidato de conexión inválido', error);
    }
  }

  #handleReject({ from, reason }) {
    if (!this.#isPeer(from)) {
      return;
    }
    this.#finish(this.#messages.rejected(reason, this.#peer.name));
  }

  #handleEnd({ from }) {
    if (!this.#isPeer(from)) {
      return;
    }
    const wasRinging = this.#state === CALL_STATES.ringing;
    this.#finish(wasRinging ? this.#messages.missed(this.#peer.name) : this.#messages.endedByPeer());
  }

  async #prepareConnection(callNumber) {
    const stream = await this.#media.open();
    if (!this.#isCurrent(callNumber)) {
      this.#media.release(stream);
      return false;
    }
    const peerId = this.#peer.id;
    this.#localStream = stream;
    this.#view.showLocalStream(stream);
    this.#session = this.#createPeerSession({
      onCandidate: (candidate) => this.#signaling.sendCandidate(peerId, candidate),
      onRemoteStream: (remoteStream) => this.#view.showRemoteStream(remoteStream),
      onFailure: () => this.#finish(this.#messages.connectionLost()),
    });
    this.#session.addLocalStream(stream);
    const earlyCandidates = this.#earlyCandidates.splice(0);
    await Promise.all(earlyCandidates.map((candidate) => this.#session.addCandidate(candidate)));
    return true;
  }

  #begin(state, peer) {
    this.#state = state;
    this.#peer = peer;
    this.#callNumber += 1;
    this.#onBusyChange(true);
    return this.#callNumber;
  }

  #activate(peer) {
    this.#state = CALL_STATES.active;
    this.#view.setStatus(this.#messages.inCall(peer.name));
  }

  #isCurrent(callNumber) {
    return this.#callNumber === callNumber && this.#state !== CALL_STATES.idle;
  }

  #isPeer(userId) {
    return this.#peer !== null && this.#peer.id === userId;
  }

  #fail(callNumber, error) {
    if (!this.#isCurrent(callNumber)) {
      return;
    }
    this.#logger.warn('La videollamada falló', error);
    this.#finish(error instanceof MediaAccessError ? error.message : this.#messages.failed());
  }

  #finish(message) {
    this.#session?.close();
    this.#media.release(this.#localStream);
    this.#view.hideIncoming();
    this.#view.hideCall();
    this.#state = CALL_STATES.idle;
    this.#callNumber += 1;
    this.#peer = null;
    this.#session = null;
    this.#localStream = null;
    this.#pendingOffer = null;
    this.#earlyCandidates = [];
    this.#onBusyChange(false);
    if (message !== null) {
      this.#notify(message);
    }
  }
}
