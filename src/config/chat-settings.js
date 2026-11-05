/** Límites del chat: única fuente de verdad para servidor y navegador. */
export const CHAT_LIMITS = Object.freeze({
  nameLength: 30,
  textLength: 500,
  historySize: 50,
  payloadBytes: 64 * 1024,
  sdpLength: 20_000,
  iceCandidateLength: 2_000,
});

export const DEFAULT_USER_NAME = 'Anónimo';

/** Cada usuario puede enviar como máximo 5 mensajes cada 5 segundos. */
export const MESSAGE_RATE = Object.freeze({ limit: 5, intervalMs: 5_000 });

/** Señales de videollamada permitidas por usuario (incluye candidatos ICE). */
export const SIGNAL_RATE = Object.freeze({ limit: 100, intervalMs: 10_000 });

/** Sala de Socket.IO a la que solo entran los usuarios que dieron su nombre. */
export const CHAT_ROOM = 'chat';
