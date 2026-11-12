import { REJECTION_REASONS } from '../../shared/protocol.js';

/** Motivo local: el servidor no confirmó el mensaje a tiempo. */
export const SEND_TIMEOUT = 'timeout';

const REJECTION_TEXTS = Object.freeze({
  [REJECTION_REASONS.rateLimited]: 'Estás enviando mensajes muy rápido. Espera un momento.',
  [REJECTION_REASONS.invalid]: 'El mensaje no es válido.',
  [REJECTION_REASONS.notJoined]: 'Todavía no has entrado al chat.',
  [REJECTION_REASONS.chatFull]: 'El chat está lleno. Intenta más tarde.',
  [REJECTION_REASONS.alreadyJoined]: 'Ya estás dentro del chat.',
  [REJECTION_REASONS.serverError]: 'Ocurrió un error en el servidor. Intenta de nuevo.',
  [SEND_TIMEOUT]: 'No se pudo confirmar el envío. Revisa tu conexión.',
});

const UNKNOWN_PROBLEM = 'No se pudo completar la acción.';

/**
 * Textos del chat que ve el usuario. Separarlos permite cambiarlos sin tocar la lógica.
 */
export class ChatTexts {
  online() {
    return 'En línea';
  }

  offline() {
    return 'Desconectado';
  }

  /** @param {string | undefined} reason uno de REJECTION_REASONS o SEND_TIMEOUT */
  problem(reason) {
    return REJECTION_TEXTS[reason] ?? UNKNOWN_PROBLEM;
  }
}
