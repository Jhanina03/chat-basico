/**
 * Contrato entre el navegador y el servidor: nombres de eventos y respuestas.
 * Este archivo lo usan los dos lados, así el contrato está en un solo lugar.
 */
export const CHAT_EVENTS = Object.freeze({
  join: 'join',
  message: 'message',
  notice: 'notice',
  users: 'users',
  rateLimited: 'rate-limited',
  serverError: 'server-error',
});

export const CALL_EVENTS = Object.freeze({
  offer: 'call:offer',
  answer: 'call:answer',
  candidate: 'call:candidate',
  reject: 'call:reject',
  end: 'call:end',
});

/** Estados de las confirmaciones (ack) que devuelve el servidor. */
export const ACK_STATUS = Object.freeze({
  joined: 'joined',
  accepted: 'accepted',
  duplicate: 'duplicate',
  rejected: 'rejected',
});

/** Motivos por los que el servidor rechaza entrar al chat o un mensaje. */
export const REJECTION_REASONS = Object.freeze({
  alreadyJoined: 'already-joined',
  chatFull: 'chat-full',
  notJoined: 'not-joined',
  rateLimited: 'rate-limited',
  invalid: 'invalid',
  serverError: 'server-error',
});

/** Motivos por los que se rechaza una videollamada. */
export const CALL_REJECT_REASONS = Object.freeze({
  rejected: 'rejected',
  busy: 'busy',
  unavailable: 'unavailable',
});
