import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CallView } from '../../public/js/call-view.js';
import { ChatView } from '../../public/js/chat-view.js';
import { JoinView } from '../../public/js/join-view.js';
import { MessageComposer } from '../../public/js/message-composer.js';
import { UserListView } from '../../public/js/user-list-view.js';
import { createTestPage } from '../support/test-page.js';

describe('DomFactory', () => {
  it('falla con un mensaje claro si falta un elemento', () => {
    const { dom } = createTestPage();
    assert.throws(() => dom.byId('no-existe'), /No existe el elemento #no-existe/);
  });

  it('inserta el texto como texto, nunca como HTML (protección XSS)', () => {
    const { dom } = createTestPage();
    const attack = '<img src=x onerror="alert(1)">';
    const element = dom.textElement('span', 'message-text', attack);
    assert.equal(element.textContent, attack);
    assert.equal(element.querySelector('img'), null);
    assert.equal(dom.button('Llamar', 'call-button').type, 'button');
  });
});

describe('JoinView', () => {
  let page;
  let view;
  let names;

  beforeEach(() => {
    page = createTestPage();
    view = new JoinView(page.dom);
    names = [];
    view.onJoin((name) => names.push(name));
  });

  it('entrega el nombre recortado y no acepta nombres vacíos', () => {
    const input = page.document.getElementById('name-input');
    input.value = '   ';
    page.submit('join-form');
    input.value = '  Jhanina  ';
    page.submit('join-form');
    assert.deepEqual(names, ['Jhanina']);
  });

  it('aplica el límite de caracteres solo si es un entero', () => {
    const input = page.document.getElementById('name-input');
    view.setMaxLength(undefined);
    assert.equal(input.maxLength, -1);
    view.setMaxLength(30);
    assert.equal(input.maxLength, 30);
  });

  it('se oculta al entrar', () => {
    view.hide();
    assert.equal(page.document.getElementById('join-screen').hidden, true);
  });
});

describe('MessageComposer', () => {
  it('envía el texto recortado, limpia la caja y no envía vacíos', () => {
    const page = createTestPage();
    const composer = new MessageComposer(page.dom);
    const sent = [];
    composer.onSend((text) => sent.push(text));
    const input = page.document.getElementById('message-input');

    input.value = '   ';
    page.submit('message-form');
    input.value = '  Hola  ';
    page.submit('message-form');

    assert.deepEqual(sent, ['Hola']);
    assert.equal(input.value, '');
    composer.setMaxLength(500);
    assert.equal(input.maxLength, 500);
    composer.setMaxLength('500');
    assert.equal(input.maxLength, 500);
  });
});

describe('ChatView', () => {
  let page;
  let view;

  beforeEach(() => {
    page = createTestPage();
    view = new ChatView(page.dom, new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }));
  });

  function items() {
    return [...page.document.querySelectorAll('#messages li')];
  }

  it('muestra mensajes propios y ajenos con autor, texto y hora', () => {
    const message = { author: 'Ana', text: 'Hola', sentAt: '2026-01-01T10:05:00.000Z' };
    view.renderMessage(message, true);
    view.renderMessage(message, false);
    const [mine, theirs] = items();
    assert.equal(mine.className, 'message mine');
    assert.equal(theirs.className, 'message');
    assert.equal(mine.querySelector('.message-author').textContent, 'Ana');
    assert.equal(mine.querySelector('.message-text').textContent, 'Hola');
    assert.equal(mine.querySelector('.message-time').textContent, '10:05');
  });

  it('muestra el HTML de un mensaje como texto (protección XSS)', () => {
    const attack = '<script>alert(1)</script>';
    view.renderMessage({ author: '<b>Hacker</b>', text: attack, sentAt: '2026-01-01T10:00:00.000Z' }, false);
    const [item] = items();
    assert.equal(item.querySelector('script'), null);
    assert.equal(item.querySelector('b'), null);
    assert.equal(item.querySelector('.message-text').textContent, attack);
  });

  it('muestra avisos, cambia el estado, se muestra y se limpia', () => {
    view.show();
    view.setStatus('En línea');
    view.renderNotice('Luis entró al chat');
    assert.equal(page.document.getElementById('chat-screen').hidden, false);
    assert.equal(page.document.getElementById('status').textContent, 'En línea');
    assert.equal(items()[0].className, 'notice');
    view.clear();
    assert.equal(items().length, 0);
  });
});

describe('UserListView', () => {
  let page;
  let view;
  let calls;
  const users = [
    { id: 'yo', name: 'Jhanina' },
    { id: 'b', name: 'Luis' },
  ];

  beforeEach(() => {
    page = createTestPage();
    view = new UserListView(page.dom);
    calls = [];
    view.onCall((user) => calls.push(user.id));
  });

  function callButtons() {
    return [...page.document.querySelectorAll('#user-list .call-button')];
  }

  it('lista a los demás usuarios con su botón de videollamada', () => {
    view.render(users, 'yo');
    const names = [...page.document.querySelectorAll('.user-name')].map((element) => element.textContent);
    assert.deepEqual(names, ['Luis']);
    const [button] = callButtons();
    assert.equal(button.getAttribute('aria-label'), 'Videollamada con Luis');
    button.click();
    assert.deepEqual(calls, ['b']);
  });

  it('avisa cuando no hay nadie más conectado', () => {
    view.render([{ id: 'yo', name: 'Jhanina' }], 'yo');
    assert.equal(page.document.querySelector('.user-empty').textContent, 'No hay nadie más conectado');
  });

  it('desactiva los botones durante una llamada', () => {
    view.render(users, 'yo');
    view.setCallingEnabled(false);
    assert.equal(callButtons()[0].disabled, true);
    view.setCallingEnabled(true);
    assert.equal(callButtons()[0].disabled, false);
  });
});

describe('CallView', () => {
  let page;
  let view;

  beforeEach(() => {
    page = createTestPage();
    view = new CallView(page.dom);
  });

  it('muestra y oculta el aviso de llamada entrante', () => {
    view.showIncoming('Luis');
    assert.equal(page.document.getElementById('incoming-text').textContent, 'Luis te está llamando');
    assert.equal(page.document.getElementById('incoming-call').hidden, false);
    view.hideIncoming();
    assert.equal(page.document.getElementById('incoming-call').hidden, true);
  });

  it('muestra la llamada con los videos y la oculta liberándolos', () => {
    const localStream = { id: 'local' };
    const remoteStream = { id: 'remoto' };
    view.showCall('Llamando a Luis…');
    view.showLocalStream(localStream);
    view.showRemoteStream(remoteStream);
    assert.equal(page.document.getElementById('call-panel').hidden, false);
    assert.equal(page.document.getElementById('call-status').textContent, 'Llamando a Luis…');
    assert.equal(page.document.getElementById('local-video').srcObject, localStream);
    assert.equal(page.document.getElementById('remote-video').srcObject, remoteStream);

    view.setStatus('En llamada con Luis');
    assert.equal(page.document.getElementById('call-status').textContent, 'En llamada con Luis');

    view.hideCall();
    assert.equal(page.document.getElementById('call-panel').hidden, true);
    assert.equal(page.document.getElementById('local-video').srcObject, null);
    assert.equal(page.document.getElementById('remote-video').srcObject, null);
  });

  it('avisa cuando se pulsan contestar, rechazar y colgar', () => {
    const clicks = [];
    view.onAccept(() => clicks.push('contestar'));
    view.onReject(() => clicks.push('rechazar'));
    view.onHangUp(() => clicks.push('colgar'));
    page.click('accept-call');
    page.click('reject-call');
    page.click('hang-up');
    assert.deepEqual(clicks, ['contestar', 'rechazar', 'colgar']);
  });
});
