/** Límites y valores por defecto del chat (única fuente de verdad). */
export const MAX_NAME_LENGTH = 30;
export const MAX_TEXT_LENGTH = 500;
export const HISTORY_LIMIT = 50;
export const DEFAULT_NAME = 'Anónimo';
export const DEFAULT_PORT = 3000;

/** Tamaño máximo de un paquete de Socket.IO (16 KB). */
export const MAX_PAYLOAD_BYTES = 16 * 1024;

/** Cada usuario puede enviar como máximo 5 mensajes cada 5 segundos. */
export const RATE_LIMIT = Object.freeze({ limit: 5, intervalMs: 5000 });

/** Límites que se comparten con el navegador. */
export const CLIENT_LIMITS = Object.freeze({
  maxNameLength: MAX_NAME_LENGTH,
  maxTextLength: MAX_TEXT_LENGTH,
});
