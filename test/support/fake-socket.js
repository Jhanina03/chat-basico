/**
 * Socket falso: guarda lo que se envía y permite simular eventos que llegan del servidor.
 */
export class FakeSocket {
  #handlers = new Map();

  constructor(id = 'self') {
    this.id = id;
    this.sent = [];
  }

  on(event, handler) {
    const handlers = this.#handlers.get(event) ?? [];
    handlers.push(handler);
    this.#handlers.set(event, handlers);
  }

  emit(event, payload) {
    this.sent.push({ event, payload });
  }

  /**
   * Simula un evento recibido y espera a que terminen sus manejadores.
   */
  async receive(event, payload) {
    const handlers = this.#handlers.get(event) ?? [];
    await Promise.all(handlers.map((handler) => handler(payload)));
  }

  sentPayloads(event) {
    return this.sent.filter((entry) => entry.event === event).map((entry) => entry.payload);
  }
}
