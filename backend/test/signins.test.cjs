require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ValidationPipe } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const { TenantContextInterceptor } = require('../dist/common/interceptors/tenant-context.interceptor');
const { JwtAuthGuard } = require('../dist/modules/auth/jwt-auth.guard');
const { PermissionPolicyService } = require('../dist/modules/rbac/permission-policy.service');
const { RolesGuard } = require('../dist/modules/rbac/roles.guard');
const { SigninsController } = require('../dist/modules/platform/signins.controller');
const { SigninsService } = require('../dist/modules/platform/signins.service');

// A repository that records what it was asked and answers with the rows it was given. Today is 2026-11-08 (UTC).
function service(rows = []) {
  const calls = [];
  const repository = {
    countByDay: async (from, to) => {
      calls.push([from, to]);
      return rows;
    },
  };
  return { calls, service: new SigninsService(repository, () => new Date('2026-11-08T15:00:00Z')) };
}

test('a range of 7 days asks for today and the six days before it, in UTC', async () => {
  const { calls, service: signins } = service();
  const result = await signins.read(7);
  assert.deepEqual(calls, [['2026-11-02', '2026-11-08']]);
  assert.equal(result.range, 7);
  assert.equal(result.from, '2026-11-02');
  assert.equal(result.to, '2026-11-08');
});

test('30 and 90 days reach 29 and 89 days back from today', async () => {
  const thirty = service();
  await thirty.service.read(30);
  assert.deepEqual(thirty.calls, [['2026-10-10', '2026-11-08']]);
  const ninety = service();
  await ninety.service.read(90);
  assert.deepEqual(ninety.calls, [['2026-08-11', '2026-11-08']]);
});

test('every day of the range is in the answer, a day with no rows has zeros', async () => {
  const { service: signins } = service([{ day: '2026-11-07', signIns: 8, failedSignIns: 2, sessionReuse: 0 }]);
  const result = await signins.read(7);
  assert.deepEqual(result.days.map((entry) => entry.day), [
    '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
  ]);
  assert.deepEqual(result.days[0], { day: '2026-11-02', signIns: 0, failedSignIns: 0, sessionReuse: 0 });
  assert.deepEqual(result.days[5], { day: '2026-11-07', signIns: 8, failedSignIns: 2, sessionReuse: 0 });
});

test('the totals add up the days and the failure rate is failed attempts over all attempts, to one decimal', async () => {
  const { service: signins } = service([
    { day: '2026-11-07', signIns: 8, failedSignIns: 2, sessionReuse: 0 },
    { day: '2026-11-08', signIns: 2, failedSignIns: 0, sessionReuse: 1 },
  ]);
  const { totals } = await signins.read(7);
  assert.deepEqual(totals, { signIns: 10, failedSignIns: 2, failureRate: 16.7, sessionReuse: 1 });
});

test('with no attempts at all the failure rate is 0, a number', async () => {
  const { service: signins } = service();
  const { totals } = await signins.read(30);
  assert.deepEqual(totals, { signIns: 0, failedSignIns: 0, failureRate: 0, sessionReuse: 0 });
  assert.equal(Number.isFinite(totals.failureRate), true);
});

test('only failed attempts give a rate of 100', async () => {
  const { service: signins } = service([{ day: '2026-11-08', signIns: 0, failedSignIns: 3, sessionReuse: 0 }]);
  assert.equal((await signins.read(7)).totals.failureRate, 100);
});

test('the answer has exactly the documented keys, so nothing a repository adds later can leak', async () => {
  const { service: signins } = service([{ day: '2026-11-08', signIns: 1, failedSignIns: 0, sessionReuse: 0, username: 'lina', ip: '10.0.0.1' }]);
  const result = await signins.read(7);
  assert.deepEqual(Object.keys(result).sort(), ['days', 'from', 'range', 'to', 'totals']);
  assert.deepEqual(Object.keys(result.totals).sort(), ['failedSignIns', 'failureRate', 'sessionReuse', 'signIns']);
  for (const entry of result.days) assert.deepEqual(Object.keys(entry).sort(), ['day', 'failedSignIns', 'sessionReuse', 'signIns']);
});

// The real controller behind the real guards, with a stub service that records the range it was asked for.
// 7 is a platform admin, 8 is the administrator of company 1 only.
async function routeApp(t) {
  const asked = [];
  const answer = { range: 30, from: '2026-10-10', to: '2026-11-08', totals: { signIns: 3, failedSignIns: 1, failureRate: 25, sessionReuse: 0 }, days: [] };
  const stub = { read: async (range) => { asked.push(range); return { ...answer, range }; } };
  const moduleRef = await Test.createTestingModule({ controllers: [SigninsController], providers: [{ provide: SigninsService, useValue: stub }] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  const reflector = new Reflector();
  const jwt = new JwtService({ secret: 'test-secret-with-at-least-32-characters' });
  const users = { isActive: async () => true };
  const members = { requireActiveMembership: async (_userId, organizationId) => ({ organizationId, roleId: '2' }) };
  const platformRoles = { hasPlatformAccess: async (id) => id === '7' };
  app.useGlobalGuards(new JwtAuthGuard(reflector, jwt), new RolesGuard(reflector, members, new PermissionPolicyService({ findScope: async () => 'all' }), users, platformRoles));
  app.useGlobalInterceptors(new TenantContextInterceptor(reflector));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  t.after(() => app.close());
  const get = (path, userId) => request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${jwt.sign({ sub: userId }, { expiresIn: '15m' })}`);
  return { asked, get, server: app.getHttpServer() };
}

test('GET /platform/signins gives a platform admin the numbers, 30 days unless a range is asked for', async (t) => {
  const { asked, get } = await routeApp(t);
  const reply = await get('/platform/signins', '7').expect(200);
  assert.deepEqual(Object.keys(reply.body).sort(), ['days', 'from', 'range', 'to', 'totals']);
  await get('/platform/signins?range=7', '7').expect(200);
  await get('/platform/signins?range=90', '7').expect(200);
  assert.deepEqual(asked, [30, 7, 90]);
});

test('a range that is not 7, 30 or 90 is a 400 and the service is not asked', async (t) => {
  const { asked, get } = await routeApp(t);
  for (const bad of ['5', 'abc', '', '0', '-7', '7.5', '30days']) await get(`/platform/signins?range=${bad}`, '7').expect(400);
  await get('/platform/signins?range=7&company=1', '7').expect(400);
  assert.deepEqual(asked, []);
});

test('a company administrator is refused, and so is a request with no sign-in', async (t) => {
  const { asked, get, server } = await routeApp(t);
  const refused = await get('/platform/signins', '8').set('X-Organization-Id', '1').expect(403);
  assert.equal(refused.body.code, 'PLATFORM_ACCESS_REQUIRED');
  await request(server).get('/platform/signins').expect(401);
  assert.deepEqual(asked, []);
});
