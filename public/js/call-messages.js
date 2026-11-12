import { CALL_REJECT_REASONS } from '../../shared/protocol.js';

const REJECT_TEXTS = Object.freeze({
  [CALL_REJECT_REASONS.busy]: (name) => `${name} está en otra llamada.`,
  [CALL_REJECT_REASONS.unavailable]: (name) => `${name} no pudo contestar.`,
  [CALL_REJECT_REASONS.rejected]: (name) => `${name} rechazó la llamada.`,
});

/**
 * Textos que ve el usuario durante una videollamada.
 * Separarlos permite cambiar o traducir los mensajes sin tocar la lógica de la llamada.
 */
export class CallMessages {
  calling(name) {
    return `Llamando a ${name}…`;
  }

  connecting(name) {
    return `Conectando con ${name}…`;
  }

  inCall(name) {
    return `En llamada con ${name}`;
  }

  rejected(reason, name) {
    const buildText = REJECT_TEXTS[reason] ?? REJECT_TEXTS[CALL_REJECT_REASONS.rejected];
    return buildText(name);
  }

  missed(name) {
    return `Llamada perdida de ${name}.`;
  }

  endedByPeer() {
    return 'La llamada terminó.';
  }

  hungUp() {
    return 'Llamada finalizada.';
  }

  peerLeft(name) {
    return `${name} se desconectó.`;
  }

  connectionLost() {
    return 'Se perdió la conexión de la videollamada.';
  }

  failed() {
    return 'No se pudo completar la videollamada.';
  }
}
