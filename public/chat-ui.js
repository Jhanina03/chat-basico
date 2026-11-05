export const RATE_LIMIT_NOTICE = 'Estás enviando mensajes muy rápido. Espera un momento.';

const timeFormatter = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });

/**
 * Crea un elemento con texto plano (textContent evita inyección de HTML).
 * @param {Document} doc
 * @param {string} tag
 * @param {string} className
 * @param {string} text
 * @returns {HTMLElement}
 */
export function createTextElement(doc, tag, className, text) {
  const element = doc.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

/**
 * Conecta la interfaz del chat con el servidor.
 * @param {Document} doc
 * @param {() => import('socket.io-client').Socket} connect función que abre la conexión
 * @returns {{ applyLimits: (limits: { maxNameLength: number, maxTextLength: number }) => void }}
 */
export function createChatUi(doc, connect) {
  const joinScreen = doc.getElementById('join-screen');
  const chatScreen = doc.getElementById('chat-screen');
  const joinForm = doc.getElementById('join-form');
  const nameInput = doc.getElementById('name-input');
  const messageForm = doc.getElementById('message-form');
  const messageInput = doc.getElementById('message-input');
  const messageList = doc.getElementById('messages');
  const statusLabel = doc.getElementById('status');

  let socket = null;

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }

  function renderMessage(message) {
    const item = doc.createElement('li');
    item.className = message.authorId === socket.id ? 'message mine' : 'message';
    item.append(
      createTextElement(doc, 'span', 'message-author', message.author),
      createTextElement(doc, 'span', 'message-text', message.text),
      createTextElement(doc, 'time', 'message-time', timeFormatter.format(new Date(message.sentAt))),
    );
    messageList.append(item);
    scrollToBottom();
  }

  function renderNotice(text) {
    messageList.append(createTextElement(doc, 'li', 'notice', text));
    scrollToBottom();
  }

  function joinChat(name) {
    socket = connect();
    socket.on('connect', () => {
      statusLabel.textContent = 'En línea';
      messageList.replaceChildren();
      socket.emit('join', name);
    });
    socket.on('disconnect', () => {
      statusLabel.textContent = 'Desconectado';
    });
    socket.on('history', (messages) => {
      for (const message of messages) {
        renderMessage(message);
      }
    });
    socket.on('message', renderMessage);
    socket.on('notice', renderNotice);
    socket.on('rate-limited', () => renderNotice(RATE_LIMIT_NOTICE));
  }

  joinForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (name === '') {
      return;
    }
    joinScreen.hidden = true;
    chatScreen.hidden = false;
    joinChat(name);
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

  return {
    applyLimits({ maxNameLength, maxTextLength }) {
      nameInput.maxLength = maxNameLength;
      messageInput.maxLength = maxTextLength;
    },
  };
}
