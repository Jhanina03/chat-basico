const DEFAULT_PORT = 3000;
const MAX_PORT = 65_535;
const DEFAULT_DATABASE_PATH = 'data/chat.sqlite';
const DEFAULT_LOG_LEVEL = 'info';
const LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);
const MIN_METRICS_TOKEN_LENGTH = 32;
const MAX_PROXY_HOPS = 5;
const PUBLIC_STUN_SERVERS = Object.freeze(['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']);

/**
 * Configuración que depende del entorno (variables de Render o de la PC).
 * Valida todo al arrancar: si algo está mal, el servidor no inicia.
 */
export class EnvironmentConfig {
  /**
   * @param {{
   *   port: number,
   *   iceServers: RTCIceServer[],
   *   databasePath: string,
   *   metricsToken: string | null,
   *   logLevel: string,
   *   trustProxyHops: number,
   * }} values
   */
  constructor({ port, iceServers, databasePath, metricsToken, logLevel, trustProxyHops }) {
    this.port = port;
    this.iceServers = iceServers;
    this.databasePath = databasePath;
    this.metricsToken = metricsToken;
    this.logLevel = logLevel;
    this.trustProxyHops = trustProxyHops;
    Object.freeze(this);
  }

  /**
   * @param {Record<string, string | undefined>} env variables de entorno
   * @returns {EnvironmentConfig}
   * @throws {RangeError} si alguna variable tiene un valor inválido
   */
  static fromEnvironment(env) {
    return new EnvironmentConfig({
      port: EnvironmentConfig.#parsePort(env.PORT),
      iceServers: EnvironmentConfig.#parseIceServers(env),
      databasePath: env.DATABASE_PATH || DEFAULT_DATABASE_PATH,
      metricsToken: EnvironmentConfig.#parseMetricsToken(env.METRICS_TOKEN),
      logLevel: EnvironmentConfig.#parseLogLevel(env.LOG_LEVEL),
      trustProxyHops: EnvironmentConfig.#parseProxyHops(env),
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

  static #parseMetricsToken(value) {
    if (!value) {
      return null;
    }
    if (value.length < MIN_METRICS_TOKEN_LENGTH) {
      throw new RangeError(`METRICS_TOKEN debe tener al menos ${MIN_METRICS_TOKEN_LENGTH} caracteres`);
    }
    return value;
  }

  static #parseLogLevel(value) {
    const level = value || DEFAULT_LOG_LEVEL;
    if (!LOG_LEVELS.has(level)) {
      throw new RangeError(`LOG_LEVEL inválido: ${value}`);
    }
    return level;
  }

  /** Render (variable RENDER) pone un proxy delante: se confía en un salto. */
  static #parseProxyHops(env) {
    if (env.TRUST_PROXY_HOPS === undefined || env.TRUST_PROXY_HOPS === '') {
      return env.RENDER ? 1 : 0;
    }
    const hops = Number(env.TRUST_PROXY_HOPS);
    if (!Number.isInteger(hops) || hops < 0 || hops > MAX_PROXY_HOPS) {
      throw new RangeError(`TRUST_PROXY_HOPS inválido: ${env.TRUST_PROXY_HOPS}`);
    }
    return hops;
  }
}
