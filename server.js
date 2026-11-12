import { createChatServer } from './src/composition-root.js';
import { EnvironmentConfig } from './src/config/environment-config.js';
import { SystemClock } from './src/infrastructure/system-clock.js';
import { JsonLogger } from './src/observability/json-logger.js';

const clock = new SystemClock();
let logger = new JsonLogger({ clock });

process.on('unhandledRejection', (error) => {
  logger.error('unhandled_rejection', { error });
  process.exitCode = 1;
});

process.on('uncaughtException', (error) => {
  logger.error('uncaught_exception', { error });
  process.exit(1);
});

try {
  const config = EnvironmentConfig.fromEnvironment(process.env);
  logger = new JsonLogger({ clock, level: config.logLevel });
  const server = createChatServer({ environment: config, logger, clock });
  await server.start(config.port);

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      logger.info('shutdown_requested', { signal });
      server.stop().catch((error) => {
        logger.error('shutdown_failed', { error });
        process.exitCode = 1;
      });
    });
  }
} catch (error) {
  logger.error('startup_failed', { error });
  process.exitCode = 1;
}
