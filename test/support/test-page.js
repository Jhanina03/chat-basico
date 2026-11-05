import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { DomFactory } from '../../public/js/dom-factory.js';

const html = await readFile(new URL('../../public/index.html', import.meta.url), 'utf8');

/**
 * Carga la página real del chat en un navegador simulado (sin ejecutar sus scripts).
 * @returns {{ document: Document, window: Window, dom: DomFactory, submit: (formId: string) => void, click: (id: string) => void }}
 */
export function createTestPage() {
  const { window } = new JSDOM(html);
  const { document } = window;
  return {
    document,
    window,
    dom: new DomFactory(document),
    submit(formId) {
      document.getElementById(formId).dispatchEvent(new window.Event('submit', { cancelable: true }));
    },
    click(id) {
      document.getElementById(id).click();
    },
  };
}
