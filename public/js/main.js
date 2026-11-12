import { CallCoordinator } from './call-coordinator.js';
import { CallMessages } from './call-messages.js';
import { CallSignaling } from './call-signaling.js';
import { CallView } from './call-view.js';
import { ChatApplication } from './chat-application.js';
import { ChatTexts } from './chat-texts.js';
import { ChatView } from './chat-view.js';
import { DomFactory } from './dom-factory.js';
import { JoinView } from './join-view.js';
import { LocalMediaProvider } from './local-media-provider.js';
import { MessageComposer } from './message-composer.js';
import { MessageSender } from './message-sender.js';
import { PeerSession } from './peer-session.js';
import { ContactListView } from './contact-list-view.js';

/** Sin configuración del servidor: el servidor valida igual los límites. */
const FALLBACK_CONFIG = Object.freeze({ limits: {}, iceServers: [] });
const SEND_TIMEOUT_MS = 5_000;
const SEND_ATTEMPTS = 2;

async function loadClientConfig() {
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      return await response.json();
    }
    console.warn(`No se pudo cargar la configuración (HTTP ${response.status})`);
  } catch (error) {
    console.warn('No se pudo cargar la configuración', error);
  }
  return FALLBACK_CONFIG;
}

const config = await loadClientConfig();
const dom = new DomFactory(document);
const callView = new CallView(dom);
const media = new LocalMediaProvider(navigator.mediaDevices);

const application = new ChatApplication({
  connect: () => globalThis.io(),
  views: {
    join: new JoinView(dom),
    composer: new MessageComposer(dom),
    chat: new ChatView(dom),
    users: new ContactListView(dom),
  },
  texts: new ChatTexts(),
  createMessageSender: (socket, onProblem) =>
    new MessageSender({
      socket,
      createId: () => crypto.randomUUID(),
      timeoutMs: SEND_TIMEOUT_MS,
      maxAttempts: SEND_ATTEMPTS,
      onProblem,
    }),
  createCallCoordinator: (socket, { notify, onBusyChange }) =>
    new CallCoordinator({
      signaling: new CallSignaling(socket),
      view: callView,
      messages: new CallMessages(),
      media,
      createPeerSession: (handlers) =>
        new PeerSession({
          ...handlers,
          createConnection: () => new RTCPeerConnection({ iceServers: config.iceServers }),
        }),
      notify,
      onBusyChange,
      logger: console,
    }),
});

application.start(config.limits);
