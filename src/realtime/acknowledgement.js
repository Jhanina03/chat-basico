import { ACK_STATUS } from '../../shared/protocol.js';

/**
 * Socket.IO entrega como último argumento la función para confirmar (ack).
 * Si el cliente no la envió, se usa una función vacía para no fallar.
 * @param {unknown} acknowledge
 * @returns {(response: object) => void}
 */
export function toReply(acknowledge) {
  return typeof acknowledge === 'function' ? acknowledge : () => {};
}

/**
 * @param {string} reason uno de REJECTION_REASONS
 * @returns {{ status: string, reason: string }}
 */
export function rejection(reason) {
  return { status: ACK_STATUS.rejected, reason };
}
