const LEVEL_PRIORITY = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });

/** Campos que nunca se escriben en los logs (privacidad y secretos). */
const SENSITIVE_FIELDS = new Set(['text', 'token', 'credential', 'password', 'authorization', 'sdp', 'candidate']);
const REDACTED = '[redactado]';

/**
 * Registro estructurado: cada evento es una línea JSON con fecha, nivel y contexto.
 * Así los logs se pueden filtrar y buscar en producción (por ejemplo, por connectionId).
 */
export class JsonLogger {
  #write;
  #clock;
  #minimumPriority;
  #baseFields;

  /**
   * @param {{
   *   write?: (line: string) => void,
   *   clock: { now: () => Date },
   *   level?: 'debug' | 'info' | 'warn' | 'error',
   *   baseFields?: Record<string, unknown>,
   * }} options
   */
  constructor({ write = (line) => process.stdout.write(`${line}\n`), clock, level = 'info', baseFields = {} }) {
    if (!Object.hasOwn(LEVEL_PRIORITY, level)) {
      throw new RangeError(`Nivel de log inválido: ${level}`);
    }
    this.#write = write;
    this.#clock = clock;
    this.#minimumPriority = LEVEL_PRIORITY[level];
    this.#baseFields = { ...baseFields };
  }

  debug(event, fields) {
    this.#log('debug', event, fields);
  }

  info(event, fields) {
    this.#log('info', event, fields);
  }

  warn(event, fields) {
    this.#log('warn', event, fields);
  }

  error(event, fields) {
    this.#log('error', event, fields);
  }

  #log(level, event, fields = {}) {
    if (LEVEL_PRIORITY[level] < this.#minimumPriority) {
      return;
    }
    const entry = {
      ...this.#baseFields,
      ...JsonLogger.#sanitize(fields),
      time: this.#clock.now().toISOString(),
      level,
      event,
    };
    this.#write(JSON.stringify(entry));
  }

  static #sanitize(fields) {
    return Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        SENSITIVE_FIELDS.has(key.toLowerCase()) ? REDACTED : JsonLogger.#serialize(value),
      ]),
    );
  }

  static #serialize(value) {
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }
    return value;
  }
}
