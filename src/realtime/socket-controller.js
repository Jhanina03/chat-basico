/**
 * Contrato común de los controladores de Socket.IO.
 * Cada controlador atiende un grupo de eventos de una conexión.
 * Para agregar una función nueva se crea otro controlador, sin modificar los existentes.
 * @abstract
 */
export class SocketController {
  /**
   * Registra los eventos del controlador para una conexión.
   * @abstract
   * @param {import('socket.io').Socket} socket
   * @param {import('./user-session.js').UserSession} session
   */
  register(socket, session) {
    throw new Error(`${this.constructor.name} debe implementar register() para ${socket.id} / ${session.id}`);
  }
}
