import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACK_STATUS, CHAT_EVENTS, REJECTION_REASONS } from '../../shared/protocol.js';
import { ChatApplication } from '../../public/js/chat-application.js';
import { ChatTexts } from '../../public/js/chat-texts.js';
import { ChatView } from '../../public/js/chat-view.js';
import { JoinView } from '../../public/js/join-view.js';
import { MessageComposer } from '../../public/js/message-composer.js';
import { ContactListView } from '../../public/js/contact-list-view.js';
import { FakeSocket } from '../support/fake-socket.js';
import { createTestPage } from '../support/test-page.js';

const texts = new ChatTexts();

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

class RecordingMessageSender {
  constructor(onProblem) {
    this.onProblem = onProblem;
    this.sent = [];
  }

  send(text) {
    this.sent.push(text);
  }
}

describe('ChatApplication', () => {
  let page;
  let socket;
  let connections;
  let coordinator;
  let sender;

  beforeEach(() => {
    page = createTestPage();
    socket = new FakeSocket('yo');
    connections = 0;
    coordinator = null;
    sender = null;
    const application = new ChatApplication({
      connect: () => {
        connections += 1;
        return socket;
      },
      views: {
        join: new JoinView(page.dom),
        composer: new MessageComposer(page.dom),
        chat: new ChatView(page.dom),
        users: new ContactListView(page.dom),
      },
      texts,
      createCallCoordinator: (_socket, callbacks) => {
        coordinator = new RecordingCallCoordinator(callbacks);
        return coordinator;
      },
      createMessageSender: (_socket, onProblem) => {
        sender = new RecordingMessageSender(onProblem);
        return sender;
      },
    });
    application.start({ nameLength: 30, textLength: 500 });
  });

  async function join(name = 'Jhanina', history = []) {
    page.document.getElementById('name-input').value = name;
    page.submit('join-box');
    await socket.receive('connect');
    socket.acknowledgeLast(CHAT_EVENTS.join, { status: ACK_STATUS.joined, id: 'yo', name, history });
  }

  function sendText(text) {
    page.document.getElementById('message-input').value = text;
    page.submit('composer');
  }

  function itemTexts() {
    return [...page.document.querySelectorAll('#messages li')].map((item) => item.textContent);
  }

  function itemClasses() {
    return [...page.document.querySelectorAll('#messages li')].map((item) => item.className);
  }

  it('aplica los límites del servidor a las cajas de texto', () => {
    assert.equal(page.document.getElementById('name-input').maxLength, 30);
    assert.equal(page.document.getElementById('message-input').maxLength, 500);
  });

  it('no envía mensajes antes de entrar', () => {
    sendText('hola');
    assert.equal(connections, 0);
    assert.equal(sender, null);
  });

  it('entra al chat una sola vez y envía el nombre', async () => {
    await join('Jhanina');
    page.submit('join-box');
    assert.equal(connections, 1);
    assert.equal(coordinator.started, true);
    assert.equal(page.document.getElementById('join-screen').hidden, true);
    assert.equal(page.document.getElementById('chat-screen').hidden, false);
    assert.equal(page.document.getElementById('status').textContent, 'En línea');
    assert.deepEqual(socket.sentPayloads(CHAT_EVENTS.join), ['Jhanina']);
  });

  it('muestra el historial recibido y marca los mensajes propios', async () => {
    await join('Jhanina', [
      { author: 'Luis', authorId: 'luis', text: 'Antes', sentAt: '2026-01-01T10:00:00.000Z' },
      { author: 'Jhanina', authorId: 'yo', text: 'Mío', sentAt: '2026-01-01T10:01:00.000Z' },
    ]);
    await socket.receive(CHAT_EVENTS.message, {
      author: 'Luis',
      authorId: 'luis',
      text: 'Nuevo',
      sentAt: '2026-01-01T10:02:00.000Z',
    });
    assert.deepEqual(itemClasses(), ['message', 'message mine', 'message']);
  });

  it('avisa si el servidor no deja entrar', async () => {
    page.document.getElementById('name-input').value = 'Jhanina';
    page.submit('join-box');
    await socket.receive('connect');
    socket.acknowledgeLast(CHAT_EVENTS.join, { status: ACK_STATUS.rejected, reason: REJECTION_REASONS.chatFull });
    assert.deepEqual(itemTexts(), ['El chat está lleno. Intenta más tarde.']);
  });

  it('entrega los mensajes escritos al enviador', async () => {
    await join();
    sendText('Hola a todos');
    assert.deepEqual(sender.sent, ['Hola a todos']);
  });

  it('muestra avisos del servidor, de problemas de envío y de las llamadas', async () => {
    await join();
    await socket.receive(CHAT_EVENTS.notice, 'Luis entró al chat');
    sender.onProblem(REJECTION_REASONS.rateLimited);
    await socket.receive(CHAT_EVENTS.rateLimited);
    await socket.receive(CHAT_EVENTS.serverError);
    coordinator.callbacks.notify('Llamada finalizada.');
    assert.deepEqual(itemTexts(), [
      'Luis entró al chat',
      texts.problem(REJECTION_REASONS.rateLimited),
      texts.problem(REJECTION_REASONS.rateLimited),
      texts.problem(REJECTION_REASONS.serverError),
      'Llamada finalizada.',
    ]);
  });

  it('actualiza la lista de usuarios y permite llamarlos', async () => {
    await join();
    const users = [
      { id: 'yo', name: 'Jhanina' },
      { id: 'luis', name: 'Luis' },
    ];
    await socket.receive(CHAT_EVENTS.users, users);
    assert.deepEqual(coordinator.userUpdates, [users]);

    page.document.querySelector('#user-list .call-button').click();
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
