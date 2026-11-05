import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { RATE_LIMIT_NOTICE, createChatUi } from '../public/chat-ui.js';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

/** Socket falso que registra lo enviado y permite simular eventos del servidor. */
function createFakeSocket(id) {
  const handlers = new Map();
  return {
    id,
    sent: [],
    on(event, handler) {
      handlers.set(event, handler);
    },
    emit(event, payload) {
      this.sent.push({ event, payload });
    },
    trigger(event, payload) {
      handlers.get(event)(payload);
    },
  };
}

function createMessage(overrides) {
  return { id: '1', author: 'Ana', text: 'Hola', sentAt: '2026-01-01T10:00:00.000Z', authorId: 'otro', ...overrides };
}

describe('interfaz del chat', () => {
  let doc;
  let socket;
  let connections;
  let ui;

  function submit(formId) {
    const form = doc.getElementById(formId);
    form.dispatchEvent(new doc.defaultView.Event('submit', { cancelable: true }));
  }

  function join(name = 'Jhanina') {
    doc.getElementById('name-input').value = name;
    submit('join-form');
    socket.trigger('connect');
  }

  function messageItems() {
    return [...doc.querySelectorAll('#messages li')];
  }

  beforeEach(() => {
    doc = new JSDOM(html).window.document;
    socket = createFakeSocket('yo');
    connections = 0;
    ui = createChatUi(doc, () => {
      connections += 1;
      return socket;
    });
  });

  it('no entra si el nombre está vacío', () => {
    doc.getElementById('name-input').value = '   ';
    submit('join-form');
    assert.equal(connections, 0);
    assert.equal(doc.getElementById('chat-screen').hidden, true);
  });

  it('entra al chat y envía el nombre al conectarse', () => {
    join('Jhanina');
    assert.equal(doc.getElementById('join-screen').hidden, true);
    assert.equal(doc.getElementById('chat-screen').hidden, false);
    assert.equal(doc.getElementById('status').textContent, 'En línea');
    assert.deepEqual(socket.sent, [{ event: 'join', payload: 'Jhanina' }]);
  });

  it('muestra el historial recibido', () => {
    join();
    socket.trigger('history', [createMessage({ id: '1' }), createMessage({ id: '2', text: 'Chao' })]);
    assert.deepEqual(messageItems().map((item) => item.querySelector('.message-text').textContent), ['Hola', 'Chao']);
  });

  it('distingue los mensajes propios de los ajenos', () => {
    join();
    socket.trigger('message', createMessage({ authorId: 'yo' }));
    socket.trigger('message', createMessage({ authorId: 'otro' }));
    const [mine, theirs] = messageItems();
    assert.equal(mine.className, 'message mine');
    assert.equal(theirs.className, 'message');
  });

  it('muestra el HTML de un mensaje como texto (protección XSS)', () => {
    join();
    const attack = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    socket.trigger('message', createMessage({ text: attack, author: '<b>Hacker</b>' }));
    const [item] = messageItems();
    assert.equal(item.querySelector('img'), null);
    assert.equal(item.querySelector('script'), null);
    assert.equal(item.querySelector('b'), null);
    assert.equal(item.querySelector('.message-text').textContent, attack);
  });

  it('envía mensajes y limpia la caja de texto', () => {
    join();
    const input = doc.getElementById('message-input');
    input.value = '  Hola a todos  ';
    submit('message-form');
    assert.deepEqual(socket.sent.at(-1), { event: 'message', payload: 'Hola a todos' });
    assert.equal(input.value, '');
  });

  it('no envía mensajes vacíos', () => {
    join();
    doc.getElementById('message-input').value = '   ';
    submit('message-form');
    assert.equal(socket.sent.length, 1);
  });

  it('no envía mensajes antes de entrar al chat', () => {
    doc.getElementById('message-input').value = 'hola';
    submit('message-form');
    assert.equal(connections, 0);
  });

  it('muestra avisos y el aviso de spam', () => {
    join();
    socket.trigger('notice', 'Luis entró al chat');
    socket.trigger('rate-limited');
    assert.deepEqual(
      messageItems().map((item) => item.textContent),
      ['Luis entró al chat', RATE_LIMIT_NOTICE],
    );
  });

  it('indica cuando se pierde la conexión', () => {
    join();
    socket.trigger('disconnect');
    assert.equal(doc.getElementById('status').textContent, 'Desconectado');
  });

  it('aplica los límites que envía el servidor', () => {
    ui.applyLimits({ maxNameLength: 30, maxTextLength: 500 });
    assert.equal(doc.getElementById('name-input').maxLength, 30);
    assert.equal(doc.getElementById('message-input').maxLength, 500);
  });
});
