const DEFAULT_PORT = 3000;
const MAX_PORT = 65_535;
const PUBLIC_STUN_SERVERS = Object.freeze(['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']);

/**
 * Configuración que depende del entorno (variables de Render o de la PC).
 */
export class EnvironmentConfig {
  /**
   * @param {{ port: number, iceServers: RTCIceServer[] }} values
   */
  constructor({ port, iceServers }) {
    this.port = port;
    this.iceServers = iceServers;
    Object.freeze(this);
  }

  /**
   * Lee la configuración desde las variables de entorno.
   * @param {Record<string, string | undefined>} env
   * @returns {EnvironmentConfig}
   */
  static fromEnvironment(env) {
    return new EnvironmentConfig({
      port: EnvironmentConfig.#parsePort(env.PORT),
      iceServers: EnvironmentConfig.#parseIceServers(env),
    });
  }

  static #parsePort(value) {
    if (value === undefined || value === '') {
      return DEFAULT_PORT;
    }
    const port = Number(value);
    if (!Number.isInteger(port) || port < 0 || port > MAX_PORT) {
      throw new RangeError(`Puerto inválido: ${value}`);
    }
    return port;
  }

  static #parseIceServers(env) {
    const iceServers = [{ urls: [...PUBLIC_STUN_SERVERS] }];
    if (env.TURN_URL) {
      iceServers.push({
        urls: env.TURN_URL.split(',').map((url) => url.trim()),
        username: env.TURN_USERNAME ?? '',
        credential: env.TURN_CREDENTIAL ?? '',
      });
    }
    return iceServers;
  }
}
