/**
 * Nombres de los eventos que intercambian el navegador y el servidor.
 * Este archivo lo usan los dos lados, así los nombres están en un solo lugar.
 */
export const CHAT_EVENTS = Object.freeze({
  join: 'join',
  welcome: 'welcome',
  history: 'history',
  message: 'message',
  notice: 'notice',
  users: 'users',
  rateLimited: 'rate-limited',
});

export const CALL_EVENTS = Object.freeze({
  offer: 'call:offer',
  answer: 'call:answer',
  candidate: 'call:candidate',
  reject: 'call:reject',
  end: 'call:end',
});

export const REJECT_REASONS = Object.freeze({
  rejected: 'rejected',
  busy: 'busy',
  unavailable: 'unavailable',
});
