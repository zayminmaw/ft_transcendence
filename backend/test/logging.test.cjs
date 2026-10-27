require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Body, Controller, Get, Post } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const { configureApp } = require('../dist/app.setup');
const { AppLogger } = require('../dist/common/logging/app-logger');
const { currentRequestId, resolveRequestId } = require('../dist/common/context/request-context');
const { maskEmail, maskPhone, redact } = require('../dist/common/logging/redaction');

class ContextFixtureController {
	whoAmI() { return { requestId: currentRequestId() }; }
	echo(body) { return { requestId: currentRequestId(), body }; }
}
Controller('context')(ContextFixtureController);
Get('id')(ContextFixtureController.prototype, 'whoAmI', Object.getOwnPropertyDescriptor(ContextFixtureController.prototype, 'whoAmI'));
Post('echo')(ContextFixtureController.prototype, 'echo', Object.getOwnPropertyDescriptor(ContextFixtureController.prototype, 'echo'));
Body()(ContextFixtureController.prototype, 'echo', 0);

function captureLogger(level = 'verbose', extra = {}) {
	const lines = [];
	const logger = new AppLogger({ level, format: 'json', includeStack: false, write: (line) => lines.push(JSON.parse(line)), ...extra });
	return { logger, lines };
}

async function createApp(t, logger) {
	const moduleRef = await Test.createTestingModule({ controllers: [ContextFixtureController] }).compile();
	const app = moduleRef.createNestApplication({ logger: logger ?? false });
	configureApp(app, 'http://localhost:5173');
	await app.init();
	t.after(() => app.close());
	return app.getHttpServer();
}

test('a request id is generated, echoed and visible to the handler', async (t) => {
	const server = await createApp(t);
	const response = await request(server).get('/api/context/id').expect(200);
	assert.match(response.headers['x-request-id'], /^[0-9a-f-]{36}$/);
	assert.equal(response.body.requestId, response.headers['x-request-id']);
});

test('a well-formed incoming request id is kept; anything else is replaced', async (t) => {
	const server = await createApp(t);
	const kept = await request(server).get('/api/context/id').set('X-Request-Id', 'trace-12345678').expect(200);
	assert.equal(kept.body.requestId, 'trace-12345678');
	const replaced = await request(server).get('/api/context/id').set('X-Request-Id', 'bad id {"x":1}').expect(200);
	assert.match(replaced.body.requestId, /^[0-9a-f-]{36}$/);
	assert.equal(resolveRequestId('short').length, 36);
	assert.equal(resolveRequestId('x'.repeat(65)).length, 36);
});

test('the request id survives body parsing', async (t) => {
	const server = await createApp(t);
	const response = await request(server).post('/api/context/echo').set('X-Request-Id', 'post-trace-0001').send({ a: 1 }).expect(201);
	assert.equal(response.body.requestId, 'post-trace-0001');
	assert.deepEqual(response.body.body, { a: 1 });
});

test('the browser may send and read the request id header', async (t) => {
	const server = await createApp(t);
	const preflight = await request(server).options('/api/context/id')
		.set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'GET')
		.set('Access-Control-Request-Headers', 'X-Request-Id').expect(204);
	assert.match(preflight.headers['access-control-allow-headers'], /X-Request-Id/i);
	const response = await request(server).get('/api/context/id').set('Origin', 'http://localhost:5173').expect(200);
	assert.match(response.headers['access-control-expose-headers'], /X-Request-Id/i);
});

test('each finished request is logged once as JSON, without its query string', async (t) => {
	const { logger, lines } = captureLogger();
	const server = await createApp(t, logger);
	const response = await request(server).get('/api/context/id?token=abc').set('X-Request-Id', 'log-trace-0001').expect(200);
	const entry = lines.find((line) => line.context === 'HTTP');
	assert.ok(entry, 'expected a request log line');
	assert.equal(entry.msg, 'request completed');
	assert.equal(entry.path, '/api/context/id');
	assert.equal(entry.status, 200);
	assert.equal(entry.requestId, response.headers['x-request-id']);
	assert.equal(typeof entry.durationMs, 'number');
	assert.ok(!JSON.stringify(lines).includes('abc'));
});

test('the logger writes one JSON object per line with level, context and timestamp', () => {
	const { logger, lines } = captureLogger();
	logger.log('started', 'Boot');
	assert.equal(lines.length, 1);
	assert.equal(lines[0].level, 'info');
	assert.equal(lines[0].context, 'Boot');
	assert.equal(lines[0].msg, 'started');
	assert.match(lines[0].ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('levels below the threshold are dropped', () => {
	const { logger, lines } = captureLogger('warn');
	logger.debug('noise');
	logger.log('info');
	logger.warn('careful');
	logger.error('broken');
	assert.deepEqual(lines.map((line) => line.level), ['warn', 'error']);
});

test('structured fields are redacted and stacks stay out unless enabled', () => {
	const { logger, lines } = captureLogger();
	logger.log({ msg: 'login', user: { password: 'hunter2', refreshToken: 'r', name: 'ana' }, Authorization: 'Bearer x' });
	logger.error('failed', new Error('boom').stack, 'Worker');
	logger.error(new Error('kaput'));
	assert.equal(lines[0].user.password, '[REDACTED]');
	assert.equal(lines[0].user.refreshToken, '[REDACTED]');
	assert.equal(lines[0].user.name, 'ana');
	assert.equal(lines[0].Authorization, '[REDACTED]');
	assert.equal(lines[1].context, 'Worker');
	assert.equal(lines[1].stack, undefined);
	assert.deepEqual(lines[2].err, { name: 'Error', message: 'kaput' });

	const withStack = captureLogger('verbose', { includeStack: true });
	withStack.logger.error(new Error('kaput'));
	assert.match(withStack.lines[0].err.stack, /kaput/);
});

test('redaction helpers mask personal data', () => {
	assert.equal(maskEmail('jane.doe@example.com'), 'j***@e***.com');
	assert.equal(maskEmail('not-an-email'), '[REDACTED]');
	assert.equal(maskPhone('+66 81 234 5678'), '***78');
	assert.equal(maskPhone('12'), '[REDACTED]');
	assert.deepEqual(redact({ list: [{ session_id: 's', ok: 1 }] }), { list: [{ session_id: '[REDACTED]', ok: 1 }] });
});
