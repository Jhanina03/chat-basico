import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { DomFactory } from '../../public/js/dom-factory.js';

const html = await readFile(new URL('../../public/index.html', import.meta.url), 'utf8');

/**
 * Carga la página real del chat en un navegador simulado (sin ejecutar sus scripts).
 * @returns {{
 *   document: Document,
 *   window: Window,
 *   dom: DomFactory,
 *   submit: (groupId: string) => void,
 *   pressKey: (inputId: string, key: string) => boolean,
 *   click: (id: string) => void,
 * }}
 */
export function createTestPage() {
  const { window } = new JSDOM(html);
  const { document } = window;
  return {
    document,
    window,
    dom: new DomFactory(document),
    /** Pulsa el botón del grupo (por ejemplo "join-box" o "composer"). */
    submit(groupId) {
      document.querySelector(`#${groupId} button`).click();
    },
    /** Presiona una tecla en una caja de texto; devuelve false si el navegador canceló la acción. */
    pressKey(inputId, key) {
      const event = new window.KeyboardEvent('keydown', { key, cancelable: true });
      return document.getElementById(inputId).dispatchEvent(event);
    },
    click(id) {
      document.getElementById(id).click();
    },
  };
}
