import { cleanName, createMessage } from './messages.js';

/**
 * Atiende los eventos de una conexión: entrar, enviar mensajes y salir.
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {{ history: import('./messages.js').MessageHistory, rateLimiter: import('./rate-limiter.js').RateLimiter }} deps
 */
function handleConnection(io, socket, { history, rateLimiter }) {
  let userName = null;

  socket.on('join', (name) => {
    if (userName !== null) {
      return;
    }
    userName = cleanName(name);
    socket.emit('history', history.list());
    socket.broadcast.emit('notice', `${userName} entró al chat`);
  });

  socket.on('message', (text) => {
    if (userName === null) {
      return;
    }
    if (!rateLimiter.tryConsume()) {
      socket.emit('rate-limited');
      return;
    }
    const message = createMessage(userName, text);
    if (message === null) {
      return;
    }
    const outgoing = { ...message, authorId: socket.id };
    history.add(outgoing);
    io.emit('message', outgoing);
  });

  socket.on('disconnect', () => {
    if (userName !== null) {
      socket.broadcast.emit('notice', `${userName} salió del chat`);
    }
  });
}

/**
 * Registra los eventos del chat en el servidor de Socket.IO.
 * @param {import('socket.io').Server} io
 * @param {{ history: import('./messages.js').MessageHistory, createRateLimiter: () => import('./rate-limiter.js').RateLimiter }} deps
 */
export function registerChatHandlers(io, { history, createRateLimiter }) {
  io.on('connection', (socket) => {
    handleConnection(io, socket, { history, rateLimiter: createRateLimiter() });
  });
}
