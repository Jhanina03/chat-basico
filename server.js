import { createChatServer } from './src/composition-root.js';
import { EnvironmentConfig } from './src/config/environment-config.js';

try {
  const config = EnvironmentConfig.fromEnvironment(process.env);
  const server = createChatServer({ iceServers: config.iceServers });
  await server.start(config.port);

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.stop().catch((error) => {
        console.error(`Error al detener el servidor: ${error.message}`);
        process.exitCode = 1;
      });
    });
  }
} catch (error) {
  console.error(`No se pudo iniciar el chat: ${error.message}`);
  process.exitCode = 1;
}
