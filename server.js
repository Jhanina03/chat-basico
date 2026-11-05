import { parsePort, startServer } from './src/start.js';

const { stop } = startServer({ port: parsePort(process.env.PORT) });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    stop().catch((error) => {
      console.error(`Error al detener el servidor: ${error.message}`);
      process.exitCode = 1;
    });
  });
}
