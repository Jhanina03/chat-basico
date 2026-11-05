import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/rate-limiter.js';

function createClock(start = 0) {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
  };
}

describe('RateLimiter', () => {
  it('permite acciones hasta el límite', () => {
    const clock = createClock();
    const limiter = new RateLimiter({ limit: 2, intervalMs: 1000, now: clock.now });
    assert.equal(limiter.tryConsume(), true);
    assert.equal(limiter.tryConsume(), true);
    assert.equal(limiter.tryConsume(), false);
  });

  it('vuelve a permitir cuando pasa el intervalo', () => {
    const clock = createClock();
    const limiter = new RateLimiter({ limit: 1, intervalMs: 1000, now: clock.now });
    assert.equal(limiter.tryConsume(), true);
    clock.advance(999);
    assert.equal(limiter.tryConsume(), false);
    clock.advance(1);
    assert.equal(limiter.tryConsume(), true);
  });

  it('usa el reloj del sistema por defecto', () => {
    const limiter = new RateLimiter({ limit: 1, intervalMs: 60_000 });
    assert.equal(limiter.tryConsume(), true);
    assert.equal(limiter.tryConsume(), false);
  });

  it('rechaza configuraciones inválidas', () => {
    assert.throws(() => new RateLimiter({ limit: 0, intervalMs: 1000 }), RangeError);
    assert.throws(() => new RateLimiter({ limit: 1, intervalMs: -5 }), RangeError);
  });
});
