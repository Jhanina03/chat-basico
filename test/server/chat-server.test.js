import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { io as connectClient } from 'socket.io-client';
import { CALL_EVENTS, CHAT_EVENTS } from '../../shared/protocol.js';
import { createChatServer } from '../../src/composition-root.js';

const silentLogger = { info: () => {} };
const ICE_SERVERS = [{ urls: ['stun:stun.example.com:3478'] }];
const OFFER = { type: 'offer', sdp: 'v=0 oferta' };

describe('ChatServer (integración)', () => {
  let server;
  let baseUrl;
  const clients = [];

  before(async () => {
    server = createChatServer({
      iceServers: ICE_SERVERS,
      logger: silentLogger,
      messageRate: { limit: 3, intervalMs: 60_000 },
      signalRate: { limit: 10, intervalMs: 60_000 },
    });
    const port = await server.start(0);
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    for (const client of clients) {
      client.disconnect();
    }
    await server.stop();
  });

  function openClient(options = {}) {
    const client = connectClient(baseUrl, { transports: ['websocket'], ...options });
    clients.push(client);
    return client;
  }

  async function joinAs(name) {
    const client = openClient();
    const welcomePromise = once(client, CHAT_EVENTS.welcome);
    const historyPromise = once(client, CHAT_EVENTS.history);
    client.emit(CHAT_EVENTS.join, name);
    const [[welcome], [history]] = await Promise.all([welcomePromise, historyPromise]);
    return { client, welcome, history };
  }

  describe('HTTP', () => {
    it('responde en /health con cabeceras de seguridad', async () => {
      const response = await fetch(`${baseUrl}/health`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: 'ok' });
      assert.equal(response.headers.get('x-powered-by'), null);
      assert.ok(response.headers.get('content-security-policy'));
      assert.match(response.headers.get('permissions-policy'), /camera=\(self\)/);
    });

    it('comparte límites y servidores ICE con el navegador', async () => {
      const response = await fetch(`${baseUrl}/api/config`);
      assert.deepEqual(await response.json(), {
        limits: { nameLength: 30, textLength: 500 },
        iceServers: ICE_SERVERS,
      });
    });

    it('sirve la página y el protocolo compartido', async () => {
      const page = await fetch(baseUrl);
      assert.match(await page.text(), /Chat Básico/);
      const protocol = await fetch(`${baseUrl}/shared/protocol.js`);
      assert.equal(protocol.status, 200);
    });
  });

  describe('chat de texto', () => {
    it('da la bienvenida con el id y el nombre limpio', async () => {
      const { client, welcome } = await joinAs('  Carla  ');
      assert.deepEqual(welcome, { id: client.id, name: 'Carla' });
    });

    it('envía los mensajes a todos y avisa quién entra', async () => {
      const ana = await joinAs('Ana');
      const noticePromise = once(ana.client, CHAT_EVENTS.notice);
      const luis = await joinAs('Luis');
      const [notice] = await noticePromise;
      assert.equal(notice, 'Luis entró al chat');

      const received = once(ana.client, CHAT_EVENTS.message);
      luis.client.emit(CHAT_EVENTS.message, 'Hola Ana');
      const [message] = await received;
      assert.equal(message.author, 'Luis');
      assert.equal(message.text, 'Hola Ana');
      assert.equal(message.authorId, luis.client.id);
    });

    it('entrega el historial a quien entra después', async () => {
      const { history } = await joinAs('Pedro');
      assert.ok(history.some((message) => message.text === 'Hola Ana'));
    });

    it('publica la lista de usuarios conectados', async () => {
      const client = openClient();
      const usersPromise = once(client, CHAT_EVENTS.users);
      client.emit(CHAT_EVENTS.join, 'Lista');
      const [users] = await usersPromise;
      assert.ok(users.some((user) => user.id === client.id && user.name === 'Lista'));
    });

    it('ignora mensajes vacíos', async () => {
      const { client } = await joinAs('Eva');
      const texts = [];
      client.on(CHAT_EVENTS.message, (message) => texts.push(message.text));
      const received = once(client, CHAT_EVENTS.message);
      client.emit(CHAT_EVENTS.message, '   ');
      client.emit(CHAT_EVENTS.message, 'válido');
      await received;
      assert.deepEqual(texts, ['válido']);
    });

    it('ignora mensajes de quien no dio su nombre', async () => {
      const intruder = openClient();
      await once(intruder, 'connect');
      const { client } = await joinAs('Testigo');
      const texts = [];
      client.on(CHAT_EVENTS.message, (message) => texts.push(message.text));
      const received = once(client, CHAT_EVENTS.message);
      intruder.emit(CHAT_EVENTS.message, 'sin nombre');
      client.emit(CHAT_EVENTS.message, 'control');
      await received;
      assert.deepEqual(texts, ['control']);
    });

    it('no deja cambiar el nombre entrando dos veces', async () => {
      const { client } = await joinAs('Original');
      client.emit(CHAT_EVENTS.join, 'Impostor');
      const received = once(client, CHAT_EVENTS.message);
      client.emit(CHAT_EVENTS.message, 'quién soy');
      const [message] = await received;
      assert.equal(message.author, 'Original');
    });

    it('frena a quien envía demasiados mensajes', async () => {
      const { client } = await joinAs('Spam');
      const limited = once(client, CHAT_EVENTS.rateLimited);
      for (let index = 0; index < 4; index += 1) {
        client.emit(CHAT_EVENTS.message, `mensaje ${index}`);
      }
      const result = await limited;
      assert.deepEqual(result, []);
    });

    it('avisa cuando alguien sale', async () => {
      const maria = await joinAs('María');
      const entryNotice = once(maria.client, CHAT_EVENTS.notice);
      const jose = await joinAs('José');
      await entryNotice;
      const noticePromise = once(maria.client, CHAT_EVENTS.notice);
      jose.client.disconnect();
      const [notice] = await noticePromise;
      assert.equal(notice, 'José salió del chat');
    });
  });

  describe('señalización de videollamada', () => {
    it('reenvía la oferta solo a la persona indicada', async () => {
      const caller = await joinAs('Quien llama');
      const callee = await joinAs('Quien contesta');
      const received = once(callee.client, CALL_EVENTS.offer);
      caller.client.emit(CALL_EVENTS.offer, { to: callee.client.id, description: OFFER });
      const [signal] = await received;
      assert.deepEqual(signal, {
        description: OFFER,
        from: caller.client.id,
        fromName: 'Quien llama',
      });
    });

    it('descarta señales inválidas y reenvía las válidas', async () => {
      const caller = await joinAs('A');
      const callee = await joinAs('B');
      const reasons = [];
      callee.client.on(CALL_EVENTS.reject, (signal) => reasons.push(signal.reason));
      const offers = [];
      callee.client.on(CALL_EVENTS.offer, (signal) => offers.push(signal.description.sdp));
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
      const caller = await joinAs('C');
      const callee = await joinAs('D');
      const intruder = openClient();
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
  });

  describe('anti-spam de señales', () => {
    it('frena a quien envía demasiadas señales de videollamada', async () => {
      const caller = await joinAs('Insistente');
      const callee = await joinAs('Paciente');
      const limited = once(caller.client, CHAT_EVENTS.rateLimited);
      for (let index = 0; index < 11; index += 1) {
        caller.client.emit(CALL_EVENTS.end, { to: callee.client.id });
      }
      const result = await limited;
      assert.deepEqual(result, []);
    });
  });

  describe('seguridad de la conexión', () => {
    it('rechaza conexiones desde otros sitios web', async () => {
      const client = openClient({ extraHeaders: { origin: 'https://malicioso.example' } });
      const [error] = await once(client, 'connect_error');
      assert.ok(error instanceof Error);
    });
  });
});

describe('ChatServer (ciclo de vida)', () => {
  it('informa el error si el puerto está ocupado', async () => {
    const first = createChatServer({ logger: silentLogger });
    const port = await first.start(0);
    const second = createChatServer({ logger: silentLogger });
    await assert.rejects(second.start(port), { code: 'EADDRINUSE' });
    await first.stop();
  });

  it('registra el arranque y la detención', async () => {
    const lines = [];
    const server = createChatServer({ logger: { info: (line) => lines.push(line) } });
    const port = await server.start(0);
    assert.equal(server.port, port);
    await server.stop();
    assert.deepEqual(lines, [`Chat disponible en el puerto ${port}`, 'Servidor detenido']);
  });
});
