import { CALL_EVENTS, REJECT_REASONS } from '../../shared/protocol.js';

const ALLOWED_REJECT_REASONS = new Set(Object.values(REJECT_REASONS));

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value) {
  return value === null || value === undefined || typeof value === 'string';
}

function isOptionalIndex(value) {
  return value === null || value === undefined || (Number.isInteger(value) && value >= 0);
}

/**
 * Valida las señales de videollamada y devuelve solo los campos permitidos.
 */
export class CallSignalValidator {
  #sdpLength;
  #candidateLength;
  #parsers;

  /**
   * @param {{ sdpLength: number, iceCandidateLength: number }} limits
   */
  constructor({ sdpLength, iceCandidateLength }) {
    this.#sdpLength = sdpLength;
    this.#candidateLength = iceCandidateLength;
    this.#parsers = new Map([
      [CALL_EVENTS.offer, (signal) => this.#parseDescriptionSignal(signal, 'offer')],
      [CALL_EVENTS.answer, (signal) => this.#parseDescriptionSignal(signal, 'answer')],
      [CALL_EVENTS.candidate, (signal) => this.#parseCandidateSignal(signal)],
      [CALL_EVENTS.reject, (signal) => this.#parseRejectSignal(signal)],
      [CALL_EVENTS.end, () => ({})],
    ]);
  }

  /** @returns {string[]} eventos de videollamada soportados */
  get events() {
    return [...this.#parsers.keys()];
  }

  /**
   * @param {string} event
   * @param {unknown} signal
   * @returns {object | null} datos limpios para reenviar, o null si la señal no es válida
   */
  parse(event, signal) {
    const parser = this.#parsers.get(event);
    if (parser === undefined || !isPlainObject(signal)) {
      return null;
    }
    return parser(signal);
  }

  #parseDescriptionSignal(signal, expectedType) {
    const { description } = signal;
    const isValid =
      isPlainObject(description) &&
      description.type === expectedType &&
      typeof description.sdp === 'string' &&
      description.sdp.length > 0 &&
      description.sdp.length <= this.#sdpLength;
    return isValid ? { description: { type: description.type, sdp: description.sdp } } : null;
  }

  #parseCandidateSignal(signal) {
    const { candidate } = signal;
    const isValid =
      isPlainObject(candidate) &&
      typeof candidate.candidate === 'string' &&
      candidate.candidate.length <= this.#candidateLength &&
      isOptionalString(candidate.sdpMid) &&
      isOptionalIndex(candidate.sdpMLineIndex);
    if (!isValid) {
      return null;
    }
    return {
      candidate: {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid ?? null,
        sdpMLineIndex: candidate.sdpMLineIndex ?? null,
      },
    };
  }

  #parseRejectSignal(signal) {
    return { reason: ALLOWED_REJECT_REASONS.has(signal.reason) ? signal.reason : REJECT_REASONS.rejected };
  }
}
