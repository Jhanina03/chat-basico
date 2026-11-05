import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { registerChatHandlers } from './chat-handlers.js';
import { CLIENT_LIMITS, MAX_PAYLOAD_BYTES, RATE_LIMIT } from './config.js';
import { createHttpApp } from './http-app.js';
import { MessageHistory } from './messages.js';
import { isAllowedOrigin } from './origin.js';
import { RateLimiter } from './rate-limiter.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(currentDir, '..', 'public');

/**
 * Une las piezas del chat: aplicación web, Socket.IO y eventos.
 * Las dependencias se pueden reemplazar (por ejemplo, en las pruebas).
 * @param {{ history?: MessageHistory, createRateLimiter?: () => RateLimiter }} [deps]
 * @returns {{ httpServer: import('node:http').Server, io: Server }}
 */
export function createChatServer({
  history = new MessageHistory(),
  createRateLimiter = () => new RateLimiter(RATE_LIMIT),
} = {}) {
  const app = createHttpApp({ publicDir, clientLimits: CLIENT_LIMITS });
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    maxHttpBufferSize: MAX_PAYLOAD_BYTES,
    allowRequest: (req, callback) => {
      callback(null, isAllowedOrigin(req.headers.origin, req.headers.host));
    },
  });

  registerChatHandlers(io, { history, createRateLimiter });
  return { httpServer, io };
}
