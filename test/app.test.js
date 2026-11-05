import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { io as connectClient } from 'socket.io-client';
import { createChatServer } from '../src/app.js';
import { CLIENT_LIMITS, RATE_LIMIT } from '../src/config.js';

describe('servidor de chat', () => {
  let httpServer;
  let io;
  let baseUrl;
  const clients = [];

  before(async () => {
    ({ httpServer, io } = createChatServer());
    httpServer.listen(0);
    await once(httpServer, 'listening');
    baseUrl = `http://localhost:${httpServer.address().port}`;
  });

  after(async () => {
    for (const client of clients) {
      client.disconnect();
    }
    await io.close();
  });

  function openClient(options = {}) {
    const client = connectClient(baseUrl, { transports: ['websocket'], ...options });
    clients.push(client);
    return client;
  }

  async function joinAs(name) {
    const client = openClient();
    const historyPromise = once(client, 'history');
    client.emit('join', name);
    const [history] = await historyPromise;
    return { client, history };
  }

  it('responde en /health sin revelar la tecnología', async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.ok(response.headers.get('content-security-policy'));
  });

  it('comparte los límites con el navegador', async () => {
    const response = await fetch(`${baseUrl}/api/config`);
    assert.deepEqual(await response.json(), CLIENT_LIMITS);
  });

  it('sirve la página principal', async () => {
    const response = await fetch(baseUrl);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Chat Básico/);
  });

  it('envía los mensajes a todos los usuarios conectados', async () => {
    const ana = await joinAs('Ana');
    const noticePromise = once(ana.client, 'notice');
    const luis = await joinAs('Luis');
    const [notice] = await noticePromise;
    assert.equal(notice, 'Luis entró al chat');

    const received = once(ana.client, 'message');
    luis.client.emit('message', 'Hola Ana');
    const [message] = await received;

    assert.equal(message.author, 'Luis');
    assert.equal(message.text, 'Hola Ana');
    assert.equal(message.authorId, luis.client.id);
  });

  it('entrega el historial a quien entra después', async () => {
    const { history } = await joinAs('Pedro');
    assert.ok(history.some((message) => message.text === 'Hola Ana'));
  });

  it('ignora mensajes vacíos', async () => {
    const { client } = await joinAs('Eva');
    const texts = [];
    client.on('message', (message) => texts.push(message.text));
    const received = once(client, 'message');
    client.emit('message', '   ');
    client.emit('message', 'válido');
    await received;
    assert.deepEqual(texts, ['válido']);
  });

  it('ignora mensajes de quien no ha entrado al chat', async () => {
    const intruder = openClient();
    await once(intruder, 'connect');
    const { client } = await joinAs('Testigo');
    const texts = [];
    client.on('message', (message) => texts.push(message.text));
    const received = once(client, 'message');
    intruder.emit('message', 'sin nombre');
    client.emit('message', 'control');
    await received;
    assert.deepEqual(texts, ['control']);
  });

  it('ignora un segundo intento de entrar con otro nombre', async () => {
    const { client } = await joinAs('Original');
    client.emit('join', 'Impostor');
    const received = once(client, 'message');
    client.emit('message', 'quién soy');
    const [message] = await received;
    assert.equal(message.author, 'Original');
  });

  it('frena a quien envía demasiados mensajes', async () => {
    const { client } = await joinAs('Spam');
    const limited = once(client, 'rate-limited');
    for (let index = 0; index <= RATE_LIMIT.limit; index += 1) {
      client.emit('message', `mensaje ${index}`);
    }
    await limited;
  });

  it('rechaza conexiones desde otros sitios web', async () => {
    const client = openClient({ extraHeaders: { origin: 'https://malicioso.example' } });
    const [error] = await once(client, 'connect_error');
    assert.ok(error);
  });

  it('avisa cuando alguien sale', async () => {
    const maria = await joinAs('María');
    const entryNotice = once(maria.client, 'notice');
    const jose = await joinAs('José');
    await entryNotice;
    const noticePromise = once(maria.client, 'notice');
    jose.client.disconnect();
    const [notice] = await noticePromise;
    assert.equal(notice, 'José salió del chat');
  });
});
