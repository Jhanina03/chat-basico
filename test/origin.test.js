import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedOrigin } from '../src/origin.js';

describe('isAllowedOrigin', () => {
  it('acepta conexiones desde la misma página', () => {
    assert.equal(isAllowedOrigin('https://chat.example.com', 'chat.example.com'), true);
    assert.equal(isAllowedOrigin('http://localhost:3000', 'localhost:3000'), true);
  });

  it('rechaza conexiones desde otros sitios', () => {
    assert.equal(isAllowedOrigin('https://malicioso.example', 'chat.example.com'), false);
  });

  it('rechaza orígenes mal formados', () => {
    assert.equal(isAllowedOrigin('no-es-una-url', 'chat.example.com'), false);
    assert.equal(isAllowedOrigin('null', 'chat.example.com'), false);
  });

  it('acepta clientes que no son navegador (sin cabecera Origin)', () => {
    assert.equal(isAllowedOrigin(undefined, 'chat.example.com'), true);
  });
});
