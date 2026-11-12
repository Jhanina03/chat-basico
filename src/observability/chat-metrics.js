/** Métricas conocidas. Usar un nombre que no está aquí es un error de programación. */
const COUNTER_DESCRIPTIONS = Object.freeze({
  connections_total: 'Conexiones de Socket.IO aceptadas',
  connections_rejected_total: 'Conexiones rechazadas por origen o capacidad',
  joins_total: 'Usuarios que entraron al chat',
  joins_rejected_total: 'Intentos de entrar al chat rechazados',
  messages_accepted_total: 'Mensajes guardados y repartidos',
  messages_duplicate_total: 'Reintentos de mensajes ya guardados',
  messages_rejected_total: 'Mensajes rechazados',
  signals_forwarded_total: 'Señales de videollamada reenviadas',
  signals_rejected_total: 'Señales de videollamada rechazadas',
  http_requests_total: 'Peticiones HTTP atendidas',
  errors_total: 'Errores inesperados',
});

const METRIC_PREFIX = 'chat_';

function escapeLabelValue(value) {
  return String(value).replaceAll('\\', String.raw`\\`).replaceAll('"', String.raw`\"`).replaceAll('\n', String.raw`\n`);
}

function formatLabels(labels) {
  const entries = Object.entries(labels).toSorted(([first], [second]) => first.localeCompare(second));
  if (entries.length === 0) {
    return '';
  }
  const pairs = entries.map(([key, value]) => `${key}="${escapeLabelValue(value)}"`);
  return `{${pairs.join(',')}}`;
}

/**
 * Contadores y medidores del chat en formato Prometheus.
 */
export class ChatMetrics {
  #counters = new Map();
  #gauges = new Map();

  /**
   * @param {keyof typeof COUNTER_DESCRIPTIONS} name
   * @param {Record<string, string>} [labels]
   */
  increment(name, labels = {}) {
    if (!Object.hasOwn(COUNTER_DESCRIPTIONS, name)) {
      throw new RangeError(`Métrica desconocida: ${name}`);
    }
    const key = `${name}${formatLabels(labels)}`;
    const current = this.#counters.get(key);
    this.#counters.set(key, { name, labels, value: (current?.value ?? 0) + 1 });
  }

  /**
   * @param {string} name
   * @param {string} description
   * @param {() => number} read función que devuelve el valor actual
   */
  registerGauge(name, description, read) {
    this.#gauges.set(name, { description, read });
  }

  /**
   * @param {string} name
   * @param {Record<string, string>} [labels]
   * @returns {number}
   */
  value(name, labels = {}) {
    return this.#counters.get(`${name}${formatLabels(labels)}`)?.value ?? 0;
  }

  /** @returns {string} texto en formato de exposición de Prometheus */
  toPrometheus() {
    const lines = [];
    for (const [name, description] of Object.entries(COUNTER_DESCRIPTIONS)) {
      lines.push(`# HELP ${METRIC_PREFIX}${name} ${description}`, `# TYPE ${METRIC_PREFIX}${name} counter`);
      for (const counter of this.#counters.values()) {
        if (counter.name === name) {
          lines.push(`${METRIC_PREFIX}${name}${formatLabels(counter.labels)} ${counter.value}`);
        }
      }
    }
    for (const [name, gauge] of this.#gauges) {
      lines.push(
        `# HELP ${METRIC_PREFIX}${name} ${gauge.description}`,
        `# TYPE ${METRIC_PREFIX}${name} gauge`,
        `${METRIC_PREFIX}${name} ${gauge.read()}`,
      );
    }
    return `${lines.join('\n')}\n`;
  }
}
