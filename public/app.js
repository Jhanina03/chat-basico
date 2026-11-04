const { io } = globalThis;

const joinScreen = document.getElementById('join-screen');
const chatScreen = document.getElementById('chat-screen');
const joinForm = document.getElementById('join-form');
const nameInput = document.getElementById('name-input');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messageList = document.getElementById('messages');
const statusLabel = document.getElementById('status');

const timeFormatter = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });

let socket = null;

function scrollToBottom() {
  messageList.scrollTop = messageList.scrollHeight;
}

function createTextElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function renderMessage(message) {
  const item = document.createElement('li');
  item.className = message.authorId === socket.id ? 'message mine' : 'message';
  item.append(
    createTextElement('span', 'message-author', message.author),
    createTextElement('span', 'message-text', message.text),
    createTextElement('time', 'message-time', timeFormatter.format(new Date(message.sentAt))),
  );
  messageList.append(item);
  scrollToBottom();
}

function renderNotice(text) {
  messageList.append(createTextElement('li', 'notice', text));
  scrollToBottom();
}

function setStatus(text) {
  statusLabel.textContent = text;
}

function connect(name) {
  socket = io();

  socket.on('connect', () => {
    setStatus('En línea');
    messageList.replaceChildren();
    socket.emit('join', name);
  });
  socket.on('disconnect', () => setStatus('Desconectado'));
  socket.on('history', (messages) => {
    for (const message of messages) {
      renderMessage(message);
    }
  });
  socket.on('message', renderMessage);
  socket.on('notice', renderNotice);
}

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (name === '') {
    return;
  }
  joinScreen.hidden = true;
  chatScreen.hidden = false;
  connect(name);
  messageInput.focus();
});

messageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (text === '' || socket === null) {
    return;
  }
  socket.emit('message', text);
  messageInput.value = '';
  messageInput.focus();
});
