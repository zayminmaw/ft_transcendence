require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Body, Controller, Get, Post } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const { configureApp } = require('../dist/app.setup');
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

async function createApp(t) {
	const moduleRef = await Test.createTestingModule({ controllers: [ContextFixtureController] }).compile();
	const app = moduleRef.createNestApplication({ logger: false });
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

test('redaction helpers mask personal data', () => {
	assert.equal(maskEmail('jane.doe@example.com'), 'j***@e***.com');
	assert.equal(maskEmail('not-an-email'), '[REDACTED]');
	assert.equal(maskPhone('+66 81 234 5678'), '***78');
	assert.equal(maskPhone('12'), '[REDACTED]');
	assert.deepEqual(redact({ list: [{ session_id: 's', ok: 1 }] }), { list: [{ session_id: '[REDACTED]', ok: 1 }] });
});
