import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { CHAT_LIMITS, DEFAULT_USER_NAME, MESSAGE_RATE, SIGNAL_RATE } from './config/chat-settings.js';
import { CallSignalValidator } from './domain/call-signal-validator.js';
import { DisplayNamePolicy } from './domain/display-name-policy.js';
import { MessageFactory } from './domain/message-factory.js';
import { MessageHistory } from './domain/message-history.js';
import { TextSanitizer } from './domain/text-sanitizer.js';
import { UserDirectory } from './domain/user-directory.js';
import { createWebApplication } from './http/web-application.js';
import { SystemClock } from './infrastructure/system-clock.js';
import { UuidGenerator } from './infrastructure/uuid-generator.js';
import { CallSignalingController } from './realtime/call-signaling-controller.js';
import { ChatController } from './realtime/chat-controller.js';
import { SocketGateway } from './realtime/socket-gateway.js';
import { OriginPolicy } from './security/origin-policy.js';
import { RateLimiter } from './security/rate-limiter.js';
import { ChatServer } from './server/chat-server.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(currentDir, '..', 'public');
const SHARED_DIR = path.join(currentDir, '..', 'shared');

/**
 * Punto de composición: crea todas las piezas y las conecta.
 * Es el único lugar que conoce las clases concretas (inversión de dependencias).
 * @param {{
 *   iceServers?: RTCIceServer[],
 *   logger?: Pick<Console, 'info'>,
 *   clock?: { now: () => Date },
 *   messageRate?: { limit: number, intervalMs: number },
 *   signalRate?: { limit: number, intervalMs: number },
 * }} [options]
 * @returns {ChatServer}
 */
export function createChatServer({
  iceServers = [],
  logger = console,
  clock = new SystemClock(),
  messageRate = MESSAGE_RATE,
  signalRate = SIGNAL_RATE,
} = {}) {
  const clientConfig = {
    limits: { nameLength: CHAT_LIMITS.nameLength, textLength: CHAT_LIMITS.textLength },
    iceServers,
  };
  const httpServer = createServer(createWebApplication({ publicDir: PUBLIC_DIR, sharedDir: SHARED_DIR, clientConfig }));

  const originPolicy = new OriginPolicy();
  const io = new Server(httpServer, {
    maxHttpBufferSize: CHAT_LIMITS.payloadBytes,
    allowRequest: (req, callback) => {
      callback(null, originPolicy.isAllowed(req.headers.origin, req.headers.host));
    },
  });

  const sanitizer = new TextSanitizer();
  const directory = new UserDirectory();

  const chatController = new ChatController({
    io,
    directory,
    history: new MessageHistory(CHAT_LIMITS.historySize),
    messageFactory: new MessageFactory({
      sanitizer,
      clock,
      idGenerator: new UuidGenerator(),
      maxLength: CHAT_LIMITS.textLength,
    }),
    namePolicy: new DisplayNamePolicy({
      sanitizer,
      maxLength: CHAT_LIMITS.nameLength,
      fallbackName: DEFAULT_USER_NAME,
    }),
    createRateLimiter: () => new RateLimiter({ ...messageRate, clock }),
  });

  const callController = new CallSignalingController({
    io,
    directory,
    validator: new CallSignalValidator(CHAT_LIMITS),
    createRateLimiter: () => new RateLimiter({ ...signalRate, clock }),
  });

  new SocketGateway([chatController, callController]).attach(io);
  return new ChatServer({ httpServer, io, logger });
}
