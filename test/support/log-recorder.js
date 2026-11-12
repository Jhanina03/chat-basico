import { JsonLogger } from '../../src/observability/json-logger.js';
import { ManualClock } from './manual-clock.js';

/**
 * Crea un JsonLogger real que guarda las líneas en memoria para revisarlas en las pruebas.
 * @returns {{ logger: JsonLogger, entries: object[], events: () => string[] }}
 */
export function createLogRecorder(level = 'debug') {
  const entries = [];
  const logger = new JsonLogger({
    clock: new ManualClock(),
    level,
    write: (line) => entries.push(JSON.parse(line)),
  });
  return { logger, entries, events: () => entries.map((entry) => entry.event) };
}
