import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { MessageHistory, MAX_TEXT_LENGTH, cleanName, createMessage } from './messages.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(currentDir, '..', 'public');

/**
 * Crea el servidor HTTP con Express y Socket.IO (sin iniciarlo).
 * @returns {{ httpServer: import('node:http').Server, io: Server }}
 */
export function createChatServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.static(publicDir));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, { maxHttpBufferSize: MAX_TEXT_LENGTH * 4 });
  const history = new MessageHistory();

  io.on('connection', (socket) => {
    let userName = 'Anónimo';

    socket.on('join', (name) => {
      userName = cleanName(name);
      socket.emit('history', history.list());
      socket.broadcast.emit('notice', `${userName} entró al chat`);
    });

    socket.on('message', (text) => {
      const message = createMessage(userName, text);
      if (message) {
        const outgoing = { ...message, authorId: socket.id };
        history.add(outgoing);
        io.emit('message', outgoing);
      }
    });

    socket.on('disconnect', () => {
      socket.broadcast.emit('notice', `${userName} salió del chat`);
    });
  });

  return { httpServer, io };
}
