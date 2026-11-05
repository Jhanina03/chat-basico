import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EnvironmentConfig } from '../../src/config/environment-config.js';
import { SystemClock } from '../../src/infrastructure/system-clock.js';
import { UuidGenerator } from '../../src/infrastructure/uuid-generator.js';
import { UserSession } from '../../src/realtime/user-session.js';
import { SocketController } from '../../src/realtime/socket-controller.js';
import { OriginPolicy } from '../../src/security/origin-policy.js';
import { RateLimiter } from '../../src/security/rate-limiter.js';

class ManualClock {
  #time = 0;

  now() {
    return new Date(this.#time);
  }

  advance(milliseconds) {
    this.#time += milliseconds;
  }
}

describe('RateLimiter', () => {
  it('permite acciones hasta el límite y vuelve a permitir al pasar el intervalo', () => {
    const clock = new ManualClock();
    const limiter = new RateLimiter({ limit: 2, intervalMs: 1000, clock });
    assert.equal(limiter.tryConsume(), true);
    assert.equal(limiter.tryConsume(), true);
    assert.equal(limiter.tryConsume(), false);
    clock.advance(1000);
    assert.equal(limiter.tryConsume(), true);
  });

  it('rechaza configuraciones inválidas', () => {
    const clock = new ManualClock();
    assert.throws(() => new RateLimiter({ limit: 0, intervalMs: 1000, clock }), RangeError);
    assert.throws(() => new RateLimiter({ limit: 1, intervalMs: 0.5, clock }), RangeError);
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

describe('EnvironmentConfig', () => {
  it('usa el puerto 3000 y servidores STUN públicos por defecto', () => {
    const config = EnvironmentConfig.fromEnvironment({});
    assert.equal(config.port, 3000);
    assert.equal(config.iceServers.length, 1);
    assert.ok(config.iceServers[0].urls.every((url) => url.startsWith('stun:')));
    assert.equal(Object.isFrozen(config), true);
  });

  it('lee el puerto y un servidor TURN opcional', () => {
    const config = EnvironmentConfig.fromEnvironment({
      PORT: '8080',
      TURN_URL: 'turn:turn.example.com:3478, turns:turn.example.com:5349',
      TURN_USERNAME: 'usuario',
      TURN_CREDENTIAL: 'clave',
    });
    assert.equal(config.port, 8080);
    assert.deepEqual(config.iceServers[1], {
      urls: ['turn:turn.example.com:3478', 'turns:turn.example.com:5349'],
      username: 'usuario',
      credential: 'clave',
    });
  });

  it('deja vacías las credenciales TURN que no se configuran', () => {
    const config = EnvironmentConfig.fromEnvironment({ PORT: '', TURN_URL: 'turn:turn.example.com' });
    assert.equal(config.port, 3000);
    assert.equal(config.iceServers[1].username, '');
    assert.equal(config.iceServers[1].credential, '');
  });

  it('rechaza puertos inválidos', () => {
    for (const port of ['abc', '70000', '-1', '1.5']) {
      assert.throws(() => EnvironmentConfig.fromEnvironment({ PORT: port }), RangeError);
    }
  });
});

describe('UserSession', () => {
  it('solo permite entrar una vez', () => {
    const session = new UserSession('socket-1');
    assert.equal(session.hasJoined, false);
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

  it('UuidGenerator genera identificadores distintos', () => {
    const generator = new UuidGenerator();
    const first = generator.next();
    assert.match(first, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[\da-f]{4}-[\da-f]{12}$/);
    assert.notEqual(first, generator.next());
  });
});
