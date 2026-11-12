import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { io as connectClient } from 'socket.io-client';
import { ACK_STATUS, CALL_EVENTS, CHAT_EVENTS, REJECTION_REASONS } from '../../shared/protocol.js';
import { createChatServer } from '../../src/composition-root.js';
import { openSqliteDatabase } from '../../src/persistence/sqlite-database.js';
import { SqliteMessageRepository } from '../../src/persistence/sqlite-message-repository.js';
import { createLogRecorder } from '../support/log-recorder.js';

const ICE_SERVERS = [{ urls: ['stun:stun.example.com:3478'] }];
const OFFER = { type: 'offer', sdp: 'v=0 oferta' };
const METRICS_TOKEN = 'token-de-metricas-con-mas-de-32-caracteres';
const ACK_TIMEOUT_MS = 5_000;

/** Arranca un servidor real en un puerto libre y entrega utilidades para conectarse. */
async function startTestServer(options = {}) {
  const recorder = createLogRecorder();
  const server = createChatServer({ logger: recorder.logger, ...options });
  const port = await server.start(0);
  const baseUrl = `http://localhost:${port}`;
  const clients = [];

  function openClient(clientOptions = {}) {
    const client = connectClient(baseUrl, { transports: ['websocket'], reconnection: false, ...clientOptions });
    clients.push(client);
    return client;
  }

  async function joinAs(name) {
    const client = openClient();
    const response = await client.timeout(ACK_TIMEOUT_MS).emitWithAck(CHAT_EVENTS.join, name);
    return { client, response };
  }

  function send(client, text, clientMessageId = randomUUID()) {
    return client.timeout(ACK_TIMEOUT_MS).emitWithAck(CHAT_EVENTS.message, { clientMessageId, text });
  }

  async function stop() {
    for (const client of clients) {
      client.disconnect();
    }
    await server.stop();
  }

  return { server, baseUrl, recorder, openClient, joinAs, send, stop };
}

describe('ChatServer (integración)', () => {
  let context;

  before(async () => {
    context = await startTestServer({
      environment: { iceServers: ICE_SERVERS },
      tuning: { messageRate: { limit: 3, intervalMs: 60_000 }, signalRate: { limit: 10, intervalMs: 60_000 } },
    });
  });

  after(() => context.stop());

  describe('HTTP', () => {
    it('responde /health con cabeceras de seguridad e identificador de correlación', async () => {
      const response = await fetch(`${context.baseUrl}/health`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: 'ok' });
      assert.equal(response.headers.get('x-powered-by'), null);
      assert.ok(response.headers.get('content-security-policy'));
      assert.ok(response.headers.get('strict-transport-security'));
      assert.match(response.headers.get('permissions-policy'), /camera=\(self\)/);
      assert.match(response.headers.get('x-request-id'), /^[\da-f-]{36}$/);
    });

    it('aplica una CSP estricta, aislamiento entre orígenes y sin caché', async () => {
      const response = await fetch(context.baseUrl);
      const csp = response.headers.get('content-security-policy');
      for (const directive of ["default-src 'self'", "style-src 'self'", "script-src 'self'", "frame-ancestors 'none'", "object-src 'none'"]) {
        assert.ok(csp.includes(directive), directive);
      }
      assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|\*/);
      assert.equal(response.headers.get('cross-origin-embedder-policy'), 'require-corp');
      assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
      assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('cache-control'), 'no-store');
    });

    it('sirve el cliente de Socket.IO desde Express con las mismas cabeceras', async () => {
      const client = await fetch(`${context.baseUrl}/vendor/socket.io.min.js`);
      assert.equal(client.status, 200);
      assert.match(client.headers.get('content-type'), /javascript/);
      assert.equal(client.headers.get('cache-control'), 'no-store');
      assert.equal(client.headers.get('x-content-type-options'), 'nosniff');
      const legacy = await fetch(`${context.baseUrl}/socket.io/socket.io.js`);
      assert.notEqual(legacy.status, 200);
    });

    it('las respuestas propias de Socket.IO también llevan cabeceras de seguridad', async () => {
      const response = await fetch(`${context.baseUrl}/socket.io/?EIO=4&transport=polling`);
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-security-policy'));
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('cache-control'), 'no-store');
    });

    it('reutiliza un identificador de correlación válido', async () => {
      const response = await fetch(`${context.baseUrl}/health`, { headers: { 'X-Request-Id': 'prueba-12345' } });
      assert.equal(response.headers.get('x-request-id'), 'prueba-12345');
    });

    it('comparte límites y servidores ICE con el navegador', async () => {
      const response = await fetch(`${context.baseUrl}/api/config`);
      assert.deepEqual(await response.json(), {
        limits: { nameLength: 30, textLength: 500 },
        iceServers: ICE_SERVERS,
      });
    });

    it('sirve la página y el protocolo compartido', async () => {
      const page = await fetch(context.baseUrl);
      assert.match(await page.text(), /Chat Básico/);
      const protocol = await fetch(`${context.baseUrl}/shared/protocol.js`);
      assert.equal(protocol.status, 200);
    });

    it('responde 404 en JSON y mantiene /metrics oculto sin token configurado', async () => {
      for (const route of ['/no-existe', '/metrics']) {
        const response = await fetch(`${context.baseUrl}${route}`);
        assert.equal(response.status, 404);
        const body = await response.json();
        assert.equal(body.error, 'No encontrado');
        assert.equal(body.requestId, response.headers.get('x-request-id'));
      }
    });
  });

  describe('entrar al chat', () => {
    it('confirma la entrada con id, nombre limpio e historial', async () => {
      const { client, response } = await context.joinAs('  Carla  ');
      assert.equal(response.status, ACK_STATUS.joined);
      assert.equal(response.id, client.id);
      assert.equal(response.name, 'Carla');
      assert.ok(Array.isArray(response.history));
    });

    it('no permite dos usuarios con el mismo nombre', async () => {
      const first = await context.joinAs('Repetido');
      const second = await context.joinAs('repetido');
      assert.equal(first.response.name, 'Repetido');
      assert.equal(second.response.name, 'repetido (2)');
    });

    it('rechaza entrar dos veces con la misma conexión', async () => {
      const { client } = await context.joinAs('Original');
      const second = await client.timeout(ACK_TIMEOUT_MS).emitWithAck(CHAT_EVENTS.join, 'Impostor');
      assert.deepEqual(second, { status: ACK_STATUS.rejected, reason: REJECTION_REASONS.alreadyJoined });
      const sent = await context.send(client, 'quién soy');
      assert.equal(sent.status, ACK_STATUS.accepted);
    });

    it('publica la lista de usuarios y avisa quién entra y sale', async () => {
      const ana = await context.joinAs('Ana');
      const usersPromise = once(ana.client, CHAT_EVENTS.users);
      const noticePromise = once(ana.client, CHAT_EVENTS.notice);
      const luis = await context.joinAs('Luis');
      const [[users], [notice]] = await Promise.all([usersPromise, noticePromise]);
      assert.ok(users.some((user) => user.id === luis.client.id && user.name === 'Luis'));
      assert.equal(notice, 'Luis entró al chat');

      const leftPromise = once(ana.client, CHAT_EVENTS.notice);
      luis.client.disconnect();
      const [leftNotice] = await leftPromise;
      assert.equal(leftNotice, 'Luis salió del chat');
    });
  });

  describe('mensajes', () => {
    it('confirma, guarda y reparte el mensaje a todos', async () => {
      const sender = await context.joinAs('Emisor');
      const receiver = await context.joinAs('Receptor');
      const received = once(receiver.client, CHAT_EVENTS.message);
      const ack = await context.send(sender.client, 'Hola a todos');
      const [message] = await received;
      assert.equal(ack.status, ACK_STATUS.accepted);
      assert.equal(ack.id, message.id);
      assert.equal(message.author, 'Emisor');
      assert.equal(message.authorId, sender.client.id);
      assert.equal(message.text, 'Hola a todos');
      assert.equal('clientMessageId' in message, false);

      const later = await context.joinAs('Tardío');
      assert.ok(later.response.history.some((item) => item.id === message.id));
    });

    it('un reintento con el mismo identificador no duplica el mensaje', async () => {
      const sender = await context.joinAs('Reintento');
      const receiver = await context.joinAs('Observador');
      const texts = [];
      receiver.client.on(CHAT_EVENTS.message, (message) => texts.push(message.text));
      const retryId = randomUUID();
      const first = await context.send(sender.client, 'Una sola vez', retryId);
      const retry = await context.send(sender.client, 'Una sola vez', retryId);
      const control = once(receiver.client, CHAT_EVENTS.message);
      await context.send(receiver.client, 'control');
      await control;
      assert.equal(first.status, ACK_STATUS.accepted);
      assert.equal(retry.status, ACK_STATUS.duplicate);
      assert.deepEqual(texts, ['Una sola vez', 'control']);
    });

    it('dos envíos simultáneos con el mismo identificador guardan solo uno', async () => {
      const first = await context.joinAs('Paralelo 1');
      const second = await context.joinAs('Paralelo 2');
      const sharedId = randomUUID();
      const results = await Promise.all([
        context.send(first.client, 'carrera', sharedId),
        context.send(second.client, 'carrera', sharedId),
      ]);
      const statuses = results.map((result) => result.status).toSorted();
      assert.deepEqual(statuses, [ACK_STATUS.accepted, ACK_STATUS.duplicate]);
    });

    it('muchos envíos simultáneos de varios usuarios se guardan todos', async () => {
      const users = await Promise.all(['C1', 'C2', 'C3', 'C4'].map((name) => context.joinAs(name)));
      const results = await Promise.all(
        users.flatMap(({ client }, userIndex) =>
          [0, 1, 2].map((messageIndex) => context.send(client, `u${userIndex}-m${messageIndex}`)),
        ),
      );
      assert.equal(results.length, 12);
      assert.ok(results.every((result) => result.status === ACK_STATUS.accepted));
      const reader = await context.joinAs('Lector');
      const texts = new Set(reader.response.history.map((message) => message.text));
      for (let userIndex = 0; userIndex < 4; userIndex += 1) {
        for (let messageIndex = 0; messageIndex < 3; messageIndex += 1) {
          assert.ok(texts.has(`u${userIndex}-m${messageIndex}`));
        }
      }
    });

    it('rechaza solicitudes inválidas sin repartirlas', async () => {
      const invalidRequests = [
        'texto suelto',
        { text: 'sin identificador' },
        { clientMessageId: 'no-es-uuid', text: 'hola' },
        { clientMessageId: randomUUID(), text: '   ' },
      ];
      const observer = await context.joinAs('Vigía');
      const broadcasts = [];
      observer.client.on(CHAT_EVENTS.message, (message) => broadcasts.push(message));
      for (const [index, request] of invalidRequests.entries()) {
        const { client } = await context.joinAs(`Inválido ${index}`);
        const ack = await client.timeout(ACK_TIMEOUT_MS).emitWithAck(CHAT_EVENTS.message, request);
        assert.deepEqual(ack, { status: ACK_STATUS.rejected, reason: REJECTION_REASONS.invalid });
      }
      assert.deepEqual(broadcasts, []);
    });

    it('rechaza mensajes de quien no entró al chat', async () => {
      const intruder = context.openClient();
      await once(intruder, 'connect');
      const ack = await context.send(intruder, 'sin nombre');
      assert.deepEqual(ack, { status: ACK_STATUS.rejected, reason: REJECTION_REASONS.notJoined });
    });

    it('frena a quien envía demasiados mensajes', async () => {
      const { client } = await context.joinAs('Spam');
      const results = [];
      for (let index = 0; index < 4; index += 1) {
        results.push(await context.send(client, `mensaje ${index}`));
      }
      assert.deepEqual(
        results.map((result) => result.status),
        [ACK_STATUS.accepted, ACK_STATUS.accepted, ACK_STATUS.accepted, ACK_STATUS.rejected],
      );
      assert.equal(results[3].reason, REJECTION_REASONS.rateLimited);
    });
  });

  describe('señalización de videollamada', () => {
    it('reenvía la oferta solo a la persona indicada', async () => {
      const caller = await context.joinAs('Quien llama');
      const callee = await context.joinAs('Quien contesta');
      const received = once(callee.client, CALL_EVENTS.offer);
      caller.client.emit(CALL_EVENTS.offer, { to: callee.client.id, description: OFFER });
      const [signal] = await received;
      assert.deepEqual(signal, { description: OFFER, from: caller.client.id, fromName: 'Quien llama' });
    });

    it('descarta señales inválidas y reenvía las válidas', async () => {
      const caller = await context.joinAs('A');
      const callee = await context.joinAs('B');
      const offers = [];
      const reasons = [];
      callee.client.on(CALL_EVENTS.offer, (signal) => offers.push(signal));
      callee.client.on(CALL_EVENTS.reject, (signal) => reasons.push(signal.reason));
      const lastSignal = once(callee.client, CALL_EVENTS.end);

      caller.client.emit(CALL_EVENTS.offer, { to: callee.client.id, description: { type: 'offer', sdp: '' } });
      caller.client.emit(CALL_EVENTS.offer, 'no es un objeto');
      caller.client.emit(CALL_EVENTS.reject, { to: callee.client.id, reason: 'inventado' });
      caller.client.emit(CALL_EVENTS.end, { to: callee.client.id });
      await lastSignal;

      assert.deepEqual(offers, []);
      assert.deepEqual(reasons, ['rejected']);
    });

    it('no reenvía señales a sí mismo, a desconocidos ni desde quien no entró', async () => {
      const caller = await context.joinAs('C');
      const callee = await context.joinAs('D');
      const intruder = context.openClient();
      await once(intruder, 'connect');
      const ends = [];
      caller.client.on(CALL_EVENTS.end, (signal) => ends.push(signal.from));
      callee.client.on(CALL_EVENTS.end, (signal) => ends.push(signal.from));
      const control = once(callee.client, CALL_EVENTS.end);

      caller.client.emit(CALL_EVENTS.end, { to: caller.client.id });
      caller.client.emit(CALL_EVENTS.end, { to: 'no-existe' });
      intruder.emit(CALL_EVENTS.end, { to: callee.client.id });
      caller.client.emit(CALL_EVENTS.end, { to: callee.client.id });
      await control;

      assert.deepEqual(ends, [caller.client.id]);
    });

    it('frena a quien envía demasiadas señales', async () => {
      const caller = await context.joinAs('Insistente');
      const callee = await context.joinAs('Paciente');
      const limited = once(caller.client, CHAT_EVENTS.rateLimited);
      for (let index = 0; index < 11; index += 1) {
        caller.client.emit(CALL_EVENTS.end, { to: callee.client.id });
      }
      const result = await limited;
      assert.deepEqual(result, []);
    });
  });

  describe('seguridad de la conexión', () => {
    it('rechaza conexiones desde otros sitios web y lo registra', async () => {
      const client = context.openClient({ extraHeaders: { origin: 'https://malicioso.example' } });
      const [error] = await once(client, 'connect_error');
      assert.ok(error instanceof Error);
      assert.ok(context.recorder.entries.some((entry) => entry.event === 'socket_rejected' && entry.reason === 'origin'));
    });
  });
});

describe('ChatServer (capacidad y límites)', () => {
  it('rechaza entrar cuando el chat está lleno y conexiones por encima del máximo', async () => {
    const context = await startTestServer({ tuning: { maxOnlineUsers: 1, maxConnections: 2 } });
    try {
      const first = await context.joinAs('Primera');
      const second = await context.joinAs('Segunda');
      assert.equal(first.response.status, ACK_STATUS.joined);
      assert.deepEqual(second.response, { status: ACK_STATUS.rejected, reason: REJECTION_REASONS.chatFull });

      const third = context.openClient();
      const [error] = await once(third, 'connect_error');
      assert.ok(error instanceof Error);
    } finally {
      await context.stop();
    }
  });

  it('responde 429 cuando se superan las peticiones HTTP permitidas', async () => {
    const context = await startTestServer({ tuning: { httpRate: { limit: 2, intervalMs: 60_000 } } });
    try {
      const statuses = [];
      for (let index = 0; index < 3; index += 1) {
        statuses.push((await fetch(`${context.baseUrl}/health`)).status);
      }
      assert.deepEqual(statuses, [200, 200, 429]);
    } finally {
      await context.stop();
    }
  });

  it('protege /metrics con token y expone métricas reales', async () => {
    const context = await startTestServer({ environment: { metricsToken: METRICS_TOKEN } });
    try {
      const { client } = await context.joinAs('Medida');
      await context.send(client, 'cuenta');
      const withoutToken = await fetch(`${context.baseUrl}/metrics`);
      const wrongToken = await fetch(`${context.baseUrl}/metrics`, { headers: { Authorization: 'Bearer incorrecto' } });
      const authorized = await fetch(`${context.baseUrl}/metrics`, {
        headers: { Authorization: `Bearer ${METRICS_TOKEN}` },
      });
      assert.equal(withoutToken.status, 401);
      assert.equal(withoutToken.headers.get('www-authenticate'), 'Bearer');
      assert.equal(wrongToken.status, 401);
      assert.equal(authorized.status, 200);
      const text = await authorized.text();
      assert.match(text, /chat_users_online 1/);
      assert.match(text, /chat_messages_accepted_total 1/);
      assert.match(text, /chat_joins_total 1/);
    } finally {
      await context.stop();
    }
  });
});

describe('ChatServer (fallos)', () => {
  it('si falla la base de datos responde error controlado y sigue funcionando', async () => {
    const database = openSqliteDatabase(':memory:');
    const repository = new SqliteMessageRepository({ database, capacity: 10 });
    const context = await startTestServer({ messageRepository: repository });
    try {
      const { client } = await context.joinAs('Afectada');
      database.exec(`
        CREATE TRIGGER block_insert BEFORE INSERT ON messages
        BEGIN SELECT RAISE(ABORT, 'disco lleno'); END;
      `);
      const serverError = once(client, CHAT_EVENTS.serverError);
      const failed = await context.send(client, 'no se guarda');
      await serverError;
      assert.deepEqual(failed, { status: ACK_STATUS.rejected, reason: REJECTION_REASONS.serverError });
      assert.ok(context.recorder.entries.some((entry) => entry.event === 'socket_handler_failed'));

      database.exec('DROP TRIGGER block_insert');
      const recovered = await context.send(client, 'ya funciona');
      assert.equal(recovered.status, ACK_STATUS.accepted);
      assert.equal(repository.count(), 1);
    } finally {
      await context.stop();
    }
  });

  it('informa el error si el puerto está ocupado', async () => {
    const first = createChatServer({ logger: createLogRecorder().logger });
    const port = await first.start(0);
    const second = createChatServer({ logger: createLogRecorder().logger });
    await assert.rejects(second.start(port), { code: 'EADDRINUSE' });
    await first.stop();
  });

  it('registra el arranque y la detención, y cierra la base de datos', async () => {
    const recorder = createLogRecorder();
    const database = openSqliteDatabase(':memory:');
    const server = createChatServer({
      logger: recorder.logger,
      messageRepository: new SqliteMessageRepository({ database, capacity: 5 }),
    });
    const port = await server.start(0);
    assert.equal(server.port, port);
    await server.stop();
    assert.deepEqual(recorder.events(), ['server_started', 'server_stopped']);
    assert.equal(recorder.entries[0].port, port);
    assert.throws(() => database.exec('SELECT 1'), /not open/);
  });
});
