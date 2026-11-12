import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EnvironmentConfig } from '../../src/config/environment-config.js';
import { SystemClock } from '../../src/infrastructure/system-clock.js';
import { UuidGenerator } from '../../src/infrastructure/uuid-generator.js';
import { SocketController } from '../../src/realtime/socket-controller.js';
import { UserSession } from '../../src/realtime/user-session.js';
import { BearerTokenVerifier } from '../../src/security/bearer-token-verifier.js';
import { ConnectionAdmission } from '../../src/security/connection-admission.js';
import { OriginPolicy } from '../../src/security/origin-policy.js';
import { RateLimiter } from '../../src/security/rate-limiter.js';
import { ManualClock } from '../support/manual-clock.js';

const VALID_TOKEN = 'token-de-prueba-con-mas-de-32-caracteres';

describe('RateLimiter', () => {
  it('permite acciones hasta el límite y vuelve a permitir al pasar el intervalo', () => {
    const clock = new ManualClock();
    const limiter = new RateLimiter({ limit: 2, intervalMs: 1000, clock });
    assert.equal(limiter.tryConsume(), true);
    assert.equal(limiter.tryConsume(), true);
    assert.equal(limiter.tryConsume(), false);
    clock.advance(999);
    assert.equal(limiter.tryConsume(), false);
    clock.advance(1);
    assert.equal(limiter.tryConsume(), true);
  });

  it('rechaza configuraciones inválidas', () => {
    const clock = new ManualClock();
    assert.throws(() => new RateLimiter({ limit: 0, intervalMs: 1000, clock }), /El límite/);
    assert.throws(() => new RateLimiter({ limit: 1, intervalMs: 0.5, clock }), /El intervalo/);
  });
});

describe('OriginPolicy', () => {
  const policy = new OriginPolicy();

  it('acepta conexiones desde la misma página', () => {
    assert.equal(policy.isAllowed('https://chat.example.com', 'chat.example.com'), true);
    assert.equal(policy.isAllowed('http://localhost:3000', 'localhost:3000'), true);
  });

  it('rechaza otros sitios y orígenes mal formados', () => {
    assert.equal(policy.isAllowed('https://malicioso.example', 'chat.example.com'), false);
    assert.equal(policy.isAllowed('no-es-url', 'chat.example.com'), false);
    assert.equal(policy.isAllowed('null', 'chat.example.com'), false);
  });

  it('acepta clientes que no son navegador (sin cabecera Origin)', () => {
    assert.equal(policy.isAllowed(undefined, 'chat.example.com'), true);
  });
});

describe('ConnectionAdmission', () => {
  function createAdmission(activeConnections) {
    return new ConnectionAdmission({
      originPolicy: new OriginPolicy(),
      maxConnections: 2,
      countConnections: () => activeConnections,
    });
  }

  it('acepta conexiones de la misma página mientras haya cupo', () => {
    assert.deepEqual(createAdmission(1).evaluate({ origin: 'https://a.com', host: 'a.com' }), { allowed: true });
  });

  it('rechaza por origen antes que por capacidad', () => {
    assert.deepEqual(createAdmission(5).evaluate({ origin: 'https://b.com', host: 'a.com' }), {
      allowed: false,
      reason: 'origin',
    });
  });

  it('rechaza cuando se alcanza el máximo de conexiones', () => {
    assert.deepEqual(createAdmission(2).evaluate({ origin: undefined, host: 'a.com' }), {
      allowed: false,
      reason: 'capacity',
    });
  });
});

describe('BearerTokenVerifier', () => {
  it('queda desactivado sin token', () => {
    const verifier = new BearerTokenVerifier(null);
    assert.equal(verifier.isEnabled, false);
    assert.equal(verifier.isAuthorized(`Bearer ${VALID_TOKEN}`), false);
  });

  it('acepta solo el token correcto con el esquema Bearer', () => {
    const verifier = new BearerTokenVerifier(VALID_TOKEN);
    assert.equal(verifier.isEnabled, true);
    assert.equal(verifier.isAuthorized(`Bearer ${VALID_TOKEN}`), true);
    for (const header of [undefined, VALID_TOKEN, `Basic ${VALID_TOKEN}`, 'Bearer otro', `Bearer ${VALID_TOKEN}x`]) {
      assert.equal(verifier.isAuthorized(header), false);
    }
  });
});

describe('EnvironmentConfig', () => {
  it('usa valores seguros por defecto', () => {
    const config = EnvironmentConfig.fromEnvironment({});
    assert.equal(config.port, 3000);
    assert.equal(config.databasePath, 'data/chat.sqlite');
    assert.equal(config.metricsToken, null);
    assert.equal(config.logLevel, 'info');
    assert.equal(config.trustProxyHops, 0);
    assert.equal(config.iceServers.length, 1);
    assert.ok(config.iceServers[0].urls.every((url) => url.startsWith('stun:')));
    assert.equal(Object.isFrozen(config), true);
  });

  it('lee todas las variables configurables', () => {
    const config = EnvironmentConfig.fromEnvironment({
      PORT: '8080',
      DATABASE_PATH: '/var/data/chat.sqlite',
      METRICS_TOKEN: VALID_TOKEN,
      LOG_LEVEL: 'debug',
      TRUST_PROXY_HOPS: '2',
      TURN_URL: 'turn:turn.example.com:3478, turns:turn.example.com:5349',
      TURN_USERNAME: 'usuario',
      TURN_CREDENTIAL: 'clave',
    });
    assert.equal(config.port, 8080);
    assert.equal(config.databasePath, '/var/data/chat.sqlite');
    assert.equal(config.metricsToken, VALID_TOKEN);
    assert.equal(config.logLevel, 'debug');
    assert.equal(config.trustProxyHops, 2);
    assert.deepEqual(config.iceServers[1], {
      urls: ['turn:turn.example.com:3478', 'turns:turn.example.com:5349'],
      username: 'usuario',
      credential: 'clave',
    });
  });

  it('confía en un proxy cuando corre en Render', () => {
    assert.equal(EnvironmentConfig.fromEnvironment({ RENDER: 'true' }).trustProxyHops, 1);
    assert.equal(EnvironmentConfig.fromEnvironment({ RENDER: 'true', TRUST_PROXY_HOPS: '0' }).trustProxyHops, 0);
  });

  it('deja vacías las credenciales TURN que no se configuran', () => {
    const config = EnvironmentConfig.fromEnvironment({ PORT: '', TURN_URL: 'turn:turn.example.com' });
    assert.equal(config.iceServers[1].username, '');
    assert.equal(config.iceServers[1].credential, '');
  });

  it('no arranca con valores inválidos', () => {
    const invalidEnvironments = [
      { PORT: 'abc' },
      { PORT: '70000' },
      { PORT: '-1' },
      { METRICS_TOKEN: 'corto' },
      { LOG_LEVEL: 'verbose' },
      { TRUST_PROXY_HOPS: '9' },
      { TRUST_PROXY_HOPS: 'uno' },
    ];
    for (const env of invalidEnvironments) {
      assert.throws(() => EnvironmentConfig.fromEnvironment(env), RangeError, JSON.stringify(env));
    }
  });
});

describe('UserSession', () => {
  it('solo permite entrar una vez', () => {
    const session = new UserSession('socket-1');
    assert.equal(session.hasJoined, false);
    assert.equal(session.name, null);
    assert.equal(session.join('Ana'), true);
    assert.equal(session.join('Impostor'), false);
    assert.equal(session.id, 'socket-1');
    assert.equal(session.name, 'Ana');
    assert.equal(session.hasJoined, true);
  });
});

describe('SocketController', () => {
  it('obliga a las subclases a implementar register()', () => {
    class IncompleteController extends SocketController {}
    assert.throws(
      () => new IncompleteController().register({ id: 's' }, new UserSession('s')),
      /IncompleteController debe implementar register\(\)/,
    );
  });
});

describe('infraestructura', () => {
  it('SystemClock devuelve la fecha actual', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();
    assert.ok(now >= before && now <= Date.now());
  });

  it('UuidGenerator genera identificadores UUID v4 distintos', () => {
    const generator = new UuidGenerator();
    const first = generator.next();
    assert.match(first, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    assert.notEqual(first, generator.next());
  });
});
