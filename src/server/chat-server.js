/**
 * Ciclo de vida del servidor: arrancar y detener de forma ordenada,
 * cerrando las conexiones y la base de datos.
 */
export class ChatServer {
  #httpServer;
  #io;
  #logger;
  #resources;

  /**
   * @param {{
   *   httpServer: import('node:http').Server,
   *   io: import('socket.io').Server,
   *   logger: import('../observability/json-logger.js').JsonLogger,
   *   resources: { close: () => void }[],
   * }} dependencies
   */
  constructor({ httpServer, io, logger, resources }) {
    this.#httpServer = httpServer;
    this.#io = io;
    this.#logger = logger;
    this.#resources = [...resources];
  }

  /** @returns {number | undefined} puerto en uso, si el servidor está escuchando */
  get port() {
    return this.#httpServer.address()?.port;
  }

  /**
   * @param {number} port
   * @returns {Promise<number>} puerto en el que quedó escuchando
   */
  start(port) {
    return new Promise((resolve, reject) => {
      this.#httpServer.once('error', reject);
      this.#httpServer.listen(port, () => {
        this.#httpServer.off('error', reject);
        this.#logger.info('server_started', { port: this.port });
        resolve(this.port);
      });
    });
  }

  async stop() {
    await this.#io.close();
    for (const resource of this.#resources) {
      resource.close();
    }
    this.#logger.info('server_stopped');
  }
}
