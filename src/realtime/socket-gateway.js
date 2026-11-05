import { UserSession } from './user-session.js';

/**
 * Crea una sesión por conexión y la entrega a todos los controladores.
 */
export class SocketGateway {
  #controllers;

  /**
   * @param {import('./socket-controller.js').SocketController[]} controllers
   */
  constructor(controllers) {
    this.#controllers = [...controllers];
  }

  /**
   * @param {import('socket.io').Server} io
   */
  attach(io) {
    io.on('connection', (socket) => {
      const session = new UserSession(socket.id);
      for (const controller of this.#controllers) {
        controller.register(socket, session);
      }
    });
  }
}
