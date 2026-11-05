import { CALL_EVENTS } from '../../shared/protocol.js';

/**
 * Envía y recibe las señales de videollamada a través de Socket.IO.
 * Aísla al resto del código de los nombres de eventos del protocolo.
 */
export class CallSignaling {
  #socket;

  /**
   * @param {{ emit: Function, on: Function }} socket
   */
  constructor(socket) {
    this.#socket = socket;
  }

  sendOffer(to, description) {
    this.#socket.emit(CALL_EVENTS.offer, { to, description });
  }

  sendAnswer(to, description) {
    this.#socket.emit(CALL_EVENTS.answer, { to, description });
  }

  sendCandidate(to, candidate) {
    this.#socket.emit(CALL_EVENTS.candidate, { to, candidate });
  }

  sendReject(to, reason) {
    this.#socket.emit(CALL_EVENTS.reject, { to, reason });
  }

  sendEnd(to) {
    this.#socket.emit(CALL_EVENTS.end, { to });
  }

  /**
   * @param {{
   *   onOffer: Function, onAnswer: Function, onCandidate: Function, onReject: Function, onEnd: Function,
   * }} handlers
   */
  subscribe({ onOffer, onAnswer, onCandidate, onReject, onEnd }) {
    this.#socket.on(CALL_EVENTS.offer, onOffer);
    this.#socket.on(CALL_EVENTS.answer, onAnswer);
    this.#socket.on(CALL_EVENTS.candidate, onCandidate);
    this.#socket.on(CALL_EVENTS.reject, onReject);
    this.#socket.on(CALL_EVENTS.end, onEnd);
  }
}
