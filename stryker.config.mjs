/**
 * Pruebas de mutación: Stryker cambia el código a propósito (por ejemplo, ">" por ">=")
 * y comprueba que alguna prueba falle. Si ninguna falla, la prueba no verificaba ese caso.
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  testRunner: 'command',
  commandRunner: {
    command:
      'node --disable-warning=ExperimentalWarning --test test/server/domain.test.js test/server/call-signal-validator.test.js test/server/security-and-config.test.js test/server/persistence.test.js test/server/observability.test.js test/server/socket-event-guard.test.js',
  },
  mutate: [
    'src/domain/**/*.js',
    'src/security/**/*.js',
    'src/persistence/**/*.js',
    'src/observability/**/*.js',
    'src/config/environment-config.js',
    'src/realtime/acknowledgement.js',
    'src/realtime/socket-event-guard.js',
  ],
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  thresholds: { high: 90, low: 80, break: 75 },
  concurrency: 4,
  tempDirName: '.stryker-tmp',
};
