import { createChatServer } from './app.js';
import { DEFAULT_PORT } from './config.js';

const MAX_PORT = 65_535;

/**
 * Convierte el valor de la variable PORT en un número de puerto válido.
 * @param {string | undefined} value
 * @returns {number}
 */
export function parsePort(value) {
  if (value === undefined || value === '') {
    return DEFAULT_PORT;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > MAX_PORT) {
    throw new RangeError(`Puerto inválido: ${value}`);
  }
  return port;
}

/**
 * Inicia el chat y devuelve una función para detenerlo de forma ordenada.
 * @param {{ port: number, logger?: Pick<Console, 'info' | 'error'>, onFatalError?: (error: Error) => void }} options
 */
export function startServer({
  port,
  logger = console,
  onFatalError = () => {
    process.exitCode = 1;
  },
}) {
  const { httpServer, io } = createChatServer();

  httpServer.on('error', (error) => {
    logger.error(`No se pudo iniciar el servidor: ${error.message}`);
    onFatalError(error);
  });

  httpServer.listen(port, () => {
    logger.info(`Chat disponible en el puerto ${httpServer.address().port}`);
  });

  async function stop() {
    await io.close();
    logger.info('Servidor detenido');
  }

  return { httpServer, stop };
}
