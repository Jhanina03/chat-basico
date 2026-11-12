/**
 * Socket falso: guarda lo que se envía y permite simular eventos que llegan del servidor.
 */
export class FakeSocket {
  #handlers = new Map();

  constructor(id = 'self') {
    this.id = id;
    this.sent = [];
    this.timeouts = [];
  }

  on(event, handler) {
    const handlers = this.#handlers.get(event) ?? [];
    handlers.push(handler);
    this.#handlers.set(event, handlers);
  }

  emit(event, payload, acknowledge) {
    const entry = { event, payload };
    if (acknowledge !== undefined) {
      entry.acknowledge = acknowledge;
    }
    this.sent.push(entry);
  }

  /** Imita socket.timeout(ms).emit(...) de Socket.IO. */
  timeout(milliseconds) {
    this.timeouts.push(milliseconds);
    return { emit: (event, payload, acknowledge) => this.emit(event, payload, acknowledge) };
  }

  /**
   * Simula un evento recibido y espera a que terminen sus manejadores.
   */
  async receive(event, ...args) {
    const handlers = this.#handlers.get(event) ?? [];
    await Promise.all(handlers.map((handler) => handler(...args)));
  }

  sentPayloads(event) {
    return this.sent.filter((entry) => entry.event === event).map((entry) => entry.payload);
  }

  /** Responde la confirmación (ack) del último envío de ese evento. */
  acknowledgeLast(event, ...response) {
    const entry = this.sent.findLast((candidate) => candidate.event === event);
    entry.acknowledge(...response);
  }
}
