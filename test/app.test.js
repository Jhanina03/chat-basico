import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { io as connectClient } from 'socket.io-client';
import { createChatServer } from '../src/app.js';

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

  async function joinAs(name) {
    const client = connectClient(baseUrl, { transports: ['websocket'] });
    clients.push(client);
    const historyPromise = once(client, 'history');
    client.emit('join', name);
    const [history] = await historyPromise;
    return { client, history };
  }

  it('responde en /health', async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    assert.equal(response.headers.get('x-powered-by'), null);
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
    let receivedEmpty = false;
    client.on('message', (message) => {
      receivedEmpty ||= message.text === '';
    });
    const received = once(client, 'message');
    client.emit('message', '   ');
    client.emit('message', 'válido');
    const [message] = await received;
    assert.equal(message.text, 'válido');
    assert.equal(receivedEmpty, false);
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
