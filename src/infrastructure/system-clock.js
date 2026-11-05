/**
 * Reloj del sistema. Se inyecta para poder usar un reloj falso en las pruebas.
 */
export class SystemClock {
  /** @returns {Date} */
  now() {
    return new Date();
  }
}
