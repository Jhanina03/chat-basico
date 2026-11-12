import { ACK_STATUS, CHAT_EVENTS } from '../../shared/protocol.js';
import { SEND_TIMEOUT } from './chat-texts.js';

/**
 * Envía mensajes y espera la confirmación del servidor.
 * Si no llega a tiempo, reintenta con el mismo identificador: el servidor
 * reconoce el reintento y no duplica el mensaje (envío idempotente).
 */
export class MessageSender {
  #socket;
  #createId;
  #timeoutMs;
  #maxAttempts;
  #onProblem;

  /**
   * @param {{
   *   socket: { timeout: (ms: number) => { emit: Function } },
   *   createId: () => string,
   *   timeoutMs: number,
   *   maxAttempts: number,
   *   onProblem: (reason: string) => void,
   * }} dependencies
   */
  constructor({ socket, createId, timeoutMs, maxAttempts, onProblem }) {
    this.#socket = socket;
    this.#createId = createId;
    this.#timeoutMs = timeoutMs;
    this.#maxAttempts = maxAttempts;
    this.#onProblem = onProblem;
  }

  /** @param {string} text */
  send(text) {
    this.#attempt({ clientMessageId: this.#createId(), text }, 1);
  }

  #attempt(request, attemptNumber) {
    this.#socket.timeout(this.#timeoutMs).emit(CHAT_EVENTS.message, request, (error, response) => {
      if (error) {
        this.#retryOrGiveUp(request, attemptNumber);
        return;
      }
      if (response?.status === ACK_STATUS.rejected) {
        this.#onProblem(response.reason);
      }
    });
  }

  #retryOrGiveUp(request, attemptNumber) {
    if (attemptNumber < this.#maxAttempts) {
      this.#attempt(request, attemptNumber + 1);
      return;
    }
    this.#onProblem(SEND_TIMEOUT);
  }
}
