import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { DEFAULT_PORT } from '../src/config.js';
import { parsePort, startServer } from '../src/start.js';

function createLogger() {
  const lines = [];
  return {
    lines,
    info: (text) => lines.push(text),
    error: (text) => lines.push(text),
  };
}

describe('parsePort', () => {
  it('usa el puerto por defecto si no hay valor', () => {
    assert.equal(parsePort(undefined), DEFAULT_PORT);
    assert.equal(parsePort(''), DEFAULT_PORT);
  });

  it('acepta un puerto válido', () => {
    assert.equal(parsePort('8080'), 8080);
  });

  it('rechaza puertos inválidos', () => {
    assert.throws(() => parsePort('abc'), RangeError);
    assert.throws(() => parsePort('70000'), RangeError);
    assert.throws(() => parsePort('-1'), RangeError);
  });
});

describe('startServer', () => {
  it('arranca y se detiene de forma ordenada', async () => {
    const logger = createLogger();
    const { httpServer, stop } = startServer({ port: 0, logger });
    await once(httpServer, 'listening');
    await stop();
    assert.match(logger.lines[0], /Chat disponible en el puerto \d+/);
    assert.equal(logger.lines.at(-1), 'Servidor detenido');
  });

  it('informa el error si el puerto está ocupado', async () => {
    const first = startServer({ port: 0, logger: createLogger() });
    await once(first.httpServer, 'listening');
    const busyPort = first.httpServer.address().port;

    const logger = createLogger();
    const errors = [];
    const second = startServer({ port: busyPort, logger, onFatalError: (error) => errors.push(error) });
    await once(second.httpServer, 'error');

    assert.equal(errors.length, 1);
    assert.match(logger.lines[0], /No se pudo iniciar el servidor/);
    await first.stop();
  });
});
