/**
 * Ciclo de vida del servidor: arrancar y detener de forma ordenada.
 */
export class ChatServer {
  #httpServer;
  #io;
  #logger;

  /**
   * @param {{
   *   httpServer: import('node:http').Server,
   *   io: import('socket.io').Server,
   *   logger: Pick<Console, 'info'>,
   * }} dependencies
   */
  constructor({ httpServer, io, logger }) {
    this.#httpServer = httpServer;
    this.#io = io;
    this.#logger = logger;
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
        this.#logger.info(`Chat disponible en el puerto ${this.port}`);
        resolve(this.port);
      });
    });
  }

  async stop() {
    await this.#io.close();
    this.#logger.info('Servidor detenido');
  }
}
