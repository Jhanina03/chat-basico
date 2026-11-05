import { createChatUi } from './chat-ui.js';

const ui = createChatUi(document, () => globalThis.io());

try {
  const response = await fetch('/api/config');
  if (response.ok) {
    ui.applyLimits(await response.json());
  }
} catch (error) {
  // El servidor valida igualmente los límites; solo se pierde la ayuda visual.
  console.warn('No se pudieron cargar los límites del chat', error);
}
