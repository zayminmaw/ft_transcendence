require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Controller, Get, HttpException, Req } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const { configureApp } = require('../dist/app.setup');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');

class SetupFixtureController {
  ip(request) { return { ip: request.ip }; }
  coded() { throw new HttpException({ message: 'Unable to log in.', code: 'AUTH_INVALID_CREDENTIALS' }, 401); }
  badCode() { throw new HttpException({ message: 'Bad code', code: 'not-a-code' }, 400); }
}
Controller('setup')(SetupFixtureController);
for (const name of ['ip', 'coded', 'badCode']) {
  Get(name)(SetupFixtureController.prototype, name, Object.getOwnPropertyDescriptor(SetupFixtureController.prototype, name));
}
Req()(SetupFixtureController.prototype, 'ip', 0);

async function createApp(t) {
  const moduleRef = await Test.createTestingModule({ controllers: [SetupFixtureController] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, 'http://localhost:5173');
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  t.after(() => app.close());
  return app.getHttpServer();
}

test('every API response is marked no-store and lives under /api', async (t) => {
  const server = await createApp(t);
  const response = await request(server).get('/api/setup/ip').expect(200);
  assert.equal(response.headers['cache-control'], 'no-store');
  await request(server).get('/setup/ip').expect(404);
});

test('the client address comes from the one proxy in front of the API', async (t) => {
  const server = await createApp(t);
  const response = await request(server).get('/api/setup/ip').set('X-Forwarded-For', '203.0.113.9').expect(200);
  assert.equal(response.body.ip, '203.0.113.9');
});

test('error codes reach the client only in the UPPER_SNAKE form', async (t) => {
  const server = await createApp(t);
  const coded = await request(server).get('/api/setup/coded').expect(401);
  assert.deepEqual(Object.keys(coded.body), ['statusCode', 'message', 'code', 'timestamp']);
  assert.equal(coded.body.code, 'AUTH_INVALID_CREDENTIALS');
  const bad = await request(server).get('/api/setup/badCode').expect(400);
  assert.equal(bad.body.message, 'Bad code');
  assert.equal('code' in bad.body, false);
});
