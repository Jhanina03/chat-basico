import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import {
  CHAT_LIMITS,
  CHAT_ROOM,
  DEFAULT_USER_NAME,
  HTTP_RATE,
  MESSAGE_RATE,
  SIGNAL_RATE,
} from './config/chat-settings.js';
import { CallSignalValidator } from './domain/call-signal-validator.js';
import { ChatNotices } from './domain/chat-notices.js';
import { DisplayNamePolicy } from './domain/display-name-policy.js';
import { MessageFactory } from './domain/message-factory.js';
import { TextSanitizer } from './domain/text-sanitizer.js';
import { UserDirectory } from './domain/user-directory.js';
import { applyNoCacheToEngine, createSecurityHeaders } from './http/security-headers.js';
import { createWebApplication } from './http/web-application.js';
import { SystemClock } from './infrastructure/system-clock.js';
import { UuidGenerator } from './infrastructure/uuid-generator.js';
import { ChatMetrics } from './observability/chat-metrics.js';
import { JsonLogger } from './observability/json-logger.js';
import { openSqliteDatabase } from './persistence/sqlite-database.js';
import { SqliteMessageRepository } from './persistence/sqlite-message-repository.js';
import { CallSignalingController } from './realtime/call-signaling-controller.js';
import { ChatRoom } from './realtime/chat-room.js';
import { MessagingController } from './realtime/messaging-controller.js';
import { PresenceController } from './realtime/presence-controller.js';
import { SocketEventGuard } from './realtime/socket-event-guard.js';
import { SocketGateway } from './realtime/socket-gateway.js';
import { BearerTokenVerifier } from './security/bearer-token-verifier.js';
import { ConnectionAdmission } from './security/connection-admission.js';
import { OriginPolicy } from './security/origin-policy.js';
import { RateLimiter } from './security/rate-limiter.js';
import { ChatServer } from './server/chat-server.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const socketIoDir = path.dirname(createRequire(import.meta.url).resolve('socket.io'));
const ASSETS = Object.freeze({
  publicDir: path.join(currentDir, '..', 'public'),
  sharedDir: path.join(currentDir, '..', 'shared'),
  socketClientFile: path.join(socketIoDir, '..', 'client-dist', 'socket.io.min.js'),
});

const DEFAULT_ENVIRONMENT = Object.freeze({
  iceServers: [],
  databasePath: ':memory:',
  metricsToken: null,
  trustProxyHops: 0,
});

const DEFAULT_TUNING = Object.freeze({
  messageRate: MESSAGE_RATE,
  signalRate: SIGNAL_RATE,
  httpRate: HTTP_RATE,
  maxOnlineUsers: CHAT_LIMITS.maxOnlineUsers,
  maxConnections: CHAT_LIMITS.maxConnections,
});

/**
 * Punto de composición: crea todas las piezas y las conecta.
 * Es el único lugar del servidor que conoce las clases concretas (inversión de dependencias).
 * @param {{
 *   environment?: Partial<import('./config/environment-config.js').EnvironmentConfig>,
 *   logger?: JsonLogger,
 *   clock?: { now: () => Date },
 *   tuning?: Partial<typeof DEFAULT_TUNING>,
 *   messageRepository?: SqliteMessageRepository,
 * }} [options]
 * @returns {ChatServer}
 */
export function createChatServer({ environment = {}, logger, clock = new SystemClock(), tuning = {}, messageRepository } = {}) {
  const settings = { ...DEFAULT_ENVIRONMENT, ...environment };
  const limits = { ...DEFAULT_TUNING, ...tuning };
  const log = logger ?? new JsonLogger({ clock });
  const metrics = new ChatMetrics();
  const idGenerator = new UuidGenerator();
  const repository =
    messageRepository ??
    new SqliteMessageRepository({
      database: openSqliteDatabase(settings.databasePath),
      capacity: CHAT_LIMITS.historySize,
    });

  const securityHeaders = createSecurityHeaders();
  const app = createWebApplication({
    assets: ASSETS,
    clientConfig: {
      limits: { nameLength: CHAT_LIMITS.nameLength, textLength: CHAT_LIMITS.textLength },
      iceServers: settings.iceServers,
    },
    observability: { logger: log, metrics, idGenerator },
    security: {
      securityHeaders,
      metricsAccess: new BearerTokenVerifier(settings.metricsToken),
      httpRate: limits.httpRate,
      trustProxyHops: settings.trustProxyHops,
    },
  });
  const httpServer = createServer(app);

  let io = null;
  const admission = new ConnectionAdmission({
    originPolicy: new OriginPolicy(),
    maxConnections: limits.maxConnections,
    countConnections: () => io.engine.clientsCount,
  });
  io = new Server(httpServer, {
    serveClient: false,
    maxHttpBufferSize: CHAT_LIMITS.payloadBytes,
    allowRequest: (req, callback) => {
      const decision = admission.evaluate({ origin: req.headers.origin, host: req.headers.host });
      if (!decision.allowed) {
        metrics.increment('connections_rejected_total', { reason: decision.reason });
        log.warn('socket_rejected', { reason: decision.reason });
      }
      callback(null, decision.allowed);
    },
  });
  io.engine.use(securityHeaders);
  applyNoCacheToEngine(io.engine);

  const directory = new UserDirectory();
  const room = new ChatRoom({ io, directory, roomName: CHAT_ROOM, capacity: limits.maxOnlineUsers });
  const sanitizer = new TextSanitizer();
  const eventGuard = new SocketEventGuard({ logger: log, metrics });
  metrics.registerGauge('users_online', 'Usuarios conectados al chat', () => room.size);

  const controllers = [
    new PresenceController({
      room,
      namePolicy: new DisplayNamePolicy({ sanitizer, maxLength: CHAT_LIMITS.nameLength, fallbackName: DEFAULT_USER_NAME }),
      notices: new ChatNotices(),
      history: repository,
      eventGuard,
      metrics,
    }),
    new MessagingController({
      room,
      messageFactory: new MessageFactory({ sanitizer, clock, idGenerator, maxLength: CHAT_LIMITS.textLength }),
      repository,
      createRateLimiter: () => new RateLimiter({ ...limits.messageRate, clock }),
      eventGuard,
      metrics,
    }),
    new CallSignalingController({
      room,
      validator: new CallSignalValidator(CHAT_LIMITS),
      createRateLimiter: () => new RateLimiter({ ...limits.signalRate, clock }),
      eventGuard,
      metrics,
    }),
  ];

  new SocketGateway({ controllers, logger: log, metrics }).attach(io);
  return new ChatServer({ httpServer, io, logger: log, resources: [repository] });
}
