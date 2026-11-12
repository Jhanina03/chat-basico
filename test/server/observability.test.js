import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createErrorHandler, createNotFoundHandler } from '../../src/http/http-error-handlers.js';
import { createRequestContext } from '../../src/http/request-context.js';
import { ChatMetrics } from '../../src/observability/chat-metrics.js';
import { JsonLogger } from '../../src/observability/json-logger.js';
import { createLogRecorder } from '../support/log-recorder.js';
import { ManualClock } from '../support/manual-clock.js';

class RecordingResponse extends EventEmitter {
  constructor() {
    super();
    this.locals = { requestId: 'req-12345678' };
    this.headers = {};
    this.statusCode = 200;
    this.body = undefined;
    this.headersSent = false;
  }

  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(body) {
    this.body = body;
    return this;
  }
}

function createRequest(headers = {}) {
  return { method: 'GET', path: '/ruta', get: (name) => headers[name.toLowerCase()] };
}

describe('JsonLogger', () => {
  it('escribe una línea JSON con fecha, nivel, evento y contexto', () => {
    const lines = [];
    const logger = new JsonLogger({
      clock: new ManualClock('2026-01-01T10:00:00.000Z'),
      write: (line) => lines.push(line),
      baseFields: { service: 'chat' },
    });
    logger.info('server_started', { port: 3000 });
    assert.deepEqual(JSON.parse(lines[0]), {
      time: '2026-01-01T10:00:00.000Z',
      level: 'info',
      event: 'server_started',
      service: 'chat',
      port: 3000,
    });
  });

  it('no deja que el contexto pise la fecha, el nivel ni el evento', () => {
    const { logger, entries } = createLogRecorder();
    logger.warn('evento_real', { event: 'falso', level: 'debug', time: 'ayer' });
    assert.equal(entries[0].event, 'evento_real');
    assert.equal(entries[0].level, 'warn');
    assert.equal(entries[0].time, '2026-01-01T10:00:00.000Z');
  });

  it('respeta el nivel mínimo', () => {
    const { logger, entries } = createLogRecorder('warn');
    logger.debug('oculto');
    logger.info('oculto');
    logger.warn('visible');
    logger.error('visible');
    assert.deepEqual(
      entries.map((entry) => entry.level),
      ['warn', 'error'],
    );
  });

  it('nunca escribe textos de mensajes, tokens ni credenciales', () => {
    const { logger, entries } = createLogRecorder();
    logger.info('evento', { text: 'mensaje privado', token: 'secreto', Authorization: 'Bearer x', sdp: 'v=0', user: 'Ana' });
    assert.deepEqual(entries[0].text, '[redactado]');
    assert.deepEqual(entries[0].token, '[redactado]');
    assert.deepEqual(entries[0].Authorization, '[redactado]');
    assert.deepEqual(entries[0].sdp, '[redactado]');
    assert.equal(entries[0].user, 'Ana');
  });

  it('serializa los errores con nombre, mensaje y stack', () => {
    const { logger, entries } = createLogRecorder();
    logger.error('fallo', { error: new TypeError('dato inválido') });
    assert.equal(entries[0].error.name, 'TypeError');
    assert.equal(entries[0].error.message, 'dato inválido');
    assert.match(entries[0].error.stack, /TypeError: dato inválido/);
  });

  it('rechaza niveles inválidos', () => {
    assert.throws(() => new JsonLogger({ clock: new ManualClock(), level: 'verbose' }), RangeError);
  });
});

describe('ChatMetrics', () => {
  it('cuenta eventos con y sin etiquetas', () => {
    const metrics = new ChatMetrics();
    metrics.increment('joins_total');
    metrics.increment('joins_total');
    metrics.increment('messages_rejected_total', { reason: 'invalid' });
    assert.equal(metrics.value('joins_total'), 2);
    assert.equal(metrics.value('messages_rejected_total', { reason: 'invalid' }), 1);
    assert.equal(metrics.value('messages_rejected_total', { reason: 'otro' }), 0);
  });

  it('rechaza nombres de métricas desconocidos', () => {
    assert.throws(() => new ChatMetrics().increment('inventada_total'), /Métrica desconocida/);
  });

  it('exporta en formato Prometheus con ayuda, tipo y etiquetas ordenadas', () => {
    const metrics = new ChatMetrics();
    metrics.increment('signals_rejected_total', { reason: 'invalid', event: 'call:offer' });
    metrics.registerGauge('users_online', 'Usuarios conectados', () => 4);
    const text = metrics.toPrometheus();
    assert.match(text, /# HELP chat_joins_total Usuarios que entraron al chat/);
    assert.match(text, /# TYPE chat_joins_total counter/);
    assert.match(text, /chat_signals_rejected_total\{event="call:offer",reason="invalid"\} 1/);
    assert.match(text, /# TYPE chat_users_online gauge\nchat_users_online 4/);
    assert.ok(text.endsWith('\n'));
  });

  it('escapa comillas, barras y saltos de línea en las etiquetas', () => {
    const metrics = new ChatMetrics();
    metrics.increment('errors_total', { source: 'a"b\\c\nd' });
    assert.match(metrics.toPrometheus(), /chat_errors_total\{source="a\\"b\\\\c\\nd"\} 1/);
  });
});

describe('createRequestContext', () => {
  function run(headers) {
    const { logger, entries } = createLogRecorder();
    const metrics = new ChatMetrics();
    const middleware = createRequestContext({ idGenerator: { next: () => 'generado-123' }, logger, metrics });
    const response = new RecordingResponse();
    response.locals = {};
    let nextCalled = false;
    middleware(createRequest(headers), response, () => {
      nextCalled = true;
    });
    response.statusCode = 204;
    response.emit('finish');
    return { response, entries, metrics, nextCalled };
  }

  it('genera un identificador de correlación y registra la petición', () => {
    const { response, entries, metrics, nextCalled } = run({});
    assert.equal(nextCalled, true);
    assert.equal(response.locals.requestId, 'generado-123');
    assert.equal(response.headers['x-request-id'], 'generado-123');
    assert.equal(entries[0].event, 'http_request');
    assert.equal(entries[0].status, 204);
    assert.equal(typeof entries[0].durationMs, 'number');
    assert.equal(metrics.value('http_requests_total', { status: '204' }), 1);
  });

  it('reutiliza un identificador válido y descarta uno peligroso', () => {
    assert.equal(run({ 'x-request-id': 'externo-abc123' }).response.locals.requestId, 'externo-abc123');
    assert.equal(run({ 'x-request-id': '<script>' }).response.locals.requestId, 'generado-123');
  });
});

describe('manejadores de errores HTTP', () => {
  it('responde 404 en JSON con el identificador de la petición', () => {
    const response = new RecordingResponse();
    createNotFoundHandler()(createRequest(), response);
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, { error: 'No encontrado', requestId: 'req-12345678' });
  });

  it('oculta los detalles de un error interno y lo registra', () => {
    const { logger, entries } = createLogRecorder();
    const metrics = new ChatMetrics();
    const response = new RecordingResponse();
    createErrorHandler(logger, metrics)(new Error('ruta secreta C:/servidor'), createRequest(), response, () => {});
    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { error: 'Error interno del servidor', requestId: 'req-12345678' });
    assert.doesNotMatch(JSON.stringify(response.body), /secreta/);
    assert.equal(entries[0].event, 'http_request_failed');
    assert.equal(metrics.value('errors_total', { source: 'http' }), 1);
  });

  it('informa los errores del cliente como solicitud inválida', () => {
    const { logger, entries } = createLogRecorder();
    const response = new RecordingResponse();
    const clientError = Object.assign(new Error('URI mal formada'), { status: 400 });
    createErrorHandler(logger, new ChatMetrics())(clientError, createRequest(), response, () => {});
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.error, 'Solicitud inválida');
    assert.equal(entries[0].event, 'http_request_rejected');
  });

  it('delega a Express si la respuesta ya empezó a enviarse', () => {
    const { logger } = createLogRecorder();
    const response = new RecordingResponse();
    response.headersSent = true;
    const failure = new Error('a mitad de respuesta');
    let delegated = null;
    createErrorHandler(logger, new ChatMetrics())(failure, createRequest(), response, (error) => {
      delegated = error;
    });
    assert.equal(delegated, failure);
    assert.equal(response.body, undefined);
  });
});
