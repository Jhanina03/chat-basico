import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_EVENTS } from '../../shared/protocol.js';
import { ChatApplication, RATE_LIMIT_NOTICE } from '../../public/js/chat-application.js';
import { ChatView } from '../../public/js/chat-view.js';
import { JoinView } from '../../public/js/join-view.js';
import { MessageComposer } from '../../public/js/message-composer.js';
import { UserListView } from '../../public/js/user-list-view.js';
import { FakeSocket } from '../support/fake-socket.js';
import { createTestPage } from '../support/test-page.js';

class RecordingCallCoordinator {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.started = false;
    this.calls = [];
    this.userUpdates = [];
  }

  start() {
    this.started = true;
  }

  call(user) {
    this.calls.push(user.id);
  }

  handleUsersChanged(users) {
    this.userUpdates.push(users);
  }
}

describe('ChatApplication', () => {
  let page;
  let socket;
  let connections;
  let coordinator;

  beforeEach(() => {
    page = createTestPage();
    socket = new FakeSocket('yo');
    connections = 0;
    coordinator = null;
    const application = new ChatApplication({
      connect: () => {
        connections += 1;
        return socket;
      },
      joinView: new JoinView(page.dom),
      composer: new MessageComposer(page.dom),
      chatView: new ChatView(page.dom),
      userListView: new UserListView(page.dom),
      createCallCoordinator: (_socket, callbacks) => {
        coordinator = new RecordingCallCoordinator(callbacks);
        return coordinator;
      },
    });
    application.start({ nameLength: 30, textLength: 500 });
  });

  async function join(name = 'Jhanina') {
    page.document.getElementById('name-input').value = name;
    page.submit('join-form');
    await socket.receive('connect');
    await socket.receive(CHAT_EVENTS.welcome, { id: 'yo', name });
  }

  function sendText(text) {
    page.document.getElementById('message-input').value = text;
    page.submit('message-form');
  }

  function messageTexts() {
    return [...page.document.querySelectorAll('#messages li')].map((item) => item.textContent);
  }

  it('aplica los límites del servidor a las cajas de texto', () => {
    assert.equal(page.document.getElementById('name-input').maxLength, 30);
    assert.equal(page.document.getElementById('message-input').maxLength, 500);
  });

  it('no envía mensajes antes de entrar', () => {
    sendText('hola');
    assert.equal(connections, 0);
  });

  it('entra al chat, se conecta una sola vez y envía el nombre', async () => {
    await join('Jhanina');
    page.submit('join-form');
    assert.equal(connections, 1);
    assert.equal(coordinator.started, true);
    assert.equal(page.document.getElementById('join-screen').hidden, true);
    assert.equal(page.document.getElementById('chat-screen').hidden, false);
    assert.equal(page.document.getElementById('status').textContent, 'En línea');
    assert.deepEqual(socket.sentPayloads(CHAT_EVENTS.join), ['Jhanina']);
  });

  it('envía mensajes y marca los propios', async () => {
    await join();
    sendText('Hola a todos');
    assert.deepEqual(socket.sentPayloads(CHAT_EVENTS.message), ['Hola a todos']);

    await socket.receive(CHAT_EVENTS.history, [
      { author: 'Luis', authorId: 'luis', text: 'Antes', sentAt: '2026-01-01T10:00:00.000Z' },
    ]);
    await socket.receive(CHAT_EVENTS.message, {
      author: 'Jhanina',
      authorId: 'yo',
      text: 'Mío',
      sentAt: '2026-01-01T10:01:00.000Z',
    });
    const classes = [...page.document.querySelectorAll('#messages li')].map((item) => item.className);
    assert.deepEqual(classes, ['message', 'message mine']);
  });

  it('muestra avisos del servidor, del anti-spam y de las llamadas', async () => {
    await join();
    await socket.receive(CHAT_EVENTS.notice, 'Luis entró al chat');
    await socket.receive(CHAT_EVENTS.rateLimited);
    coordinator.callbacks.notify('Llamada finalizada.');
    assert.deepEqual(messageTexts(), ['Luis entró al chat', RATE_LIMIT_NOTICE, 'Llamada finalizada.']);
  });

  it('actualiza la lista de usuarios y permite llamarlos', async () => {
    await join();
    const users = [
      { id: 'yo', name: 'Jhanina' },
      { id: 'luis', name: 'Luis' },
    ];
    await socket.receive(CHAT_EVENTS.users, users);
    assert.deepEqual(coordinator.userUpdates, [users]);

    const callButton = page.document.querySelector('#user-list .call-button');
    callButton.click();
    assert.deepEqual(coordinator.calls, ['luis']);

    coordinator.callbacks.onBusyChange(true);
    assert.equal(page.document.querySelector('#user-list .call-button').disabled, true);
  });

  it('indica cuando se pierde la conexión', async () => {
    await join();
    await socket.receive('disconnect');
    assert.equal(page.document.getElementById('status').textContent, 'Desconectado');
  });
});
