const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Global, Module } = require('@nestjs/common');
const request = require('supertest');
const { hashPassword } = require('../dist/modules/users/password');
const { ACTIVITY_NOW } = require('../dist/modules/insights/activity-recorder');
const { InsightsModule } = require('../dist/modules/insights/insights.module');
const { createAuthApp, createFakeStore, ORIGIN, PASSWORD } = require('./helpers/auth-app.cjs');

process.env.NODE_ENV = 'test';

const ACTIVITY = {
  hasHistory: true, members: { active: 3, total: 4 }, visits: 11,
  activeByDay: [{ day: '2026-11-07', members: 2 }, { day: '2026-11-08', members: 3 }],
  activeByRole: [{ roleCode: 'org_admin', roleName: 'Company administrator', members: 2 }],
};
const CHANGES = {
  changes: { total: 5, byModule: [{ module: 'clients', count: 4 }, { module: 'contacts', count: 1 }] },
  security: { passwordResets: 1, accountsSwitchedOff: 2, roleChanges: 3, deniedAttempts: 4 },
};
const TOP_KEYS = ['activeByDay', 'activeByRole', 'changes', 'from', 'hasHistory', 'members', 'range', 'security', 'to', 'visits'];

// Meridian (company 1): lina holds admin.audit_logs, dana does not. Harbor (company 2): karim holds it there.
async function insightsApp(t) {
  const passwordHash = await hashPassword(PASSWORD);
  const store = createFakeStore();
  store.rolePermissions.set('1', new Set(['admin.audit_logs']));
  store.rolePermissions.set('2', new Set(['parcels.view']));
  for (const [id, username, organizationId, roleId] of [['10', 'lina', '1', '1'], ['12', 'dana', '1', '2'], ['15', 'karim', '2', '1']]) {
    store.users.push({ id, username, email: `${username}@demo.example.test`, passwordHash, isActive: true });
    store.memberships.push({ organizationId, userId: id, roleId, isActive: true });
  }
  store.insightResults = { 1: { activity: ACTIVITY, changes: CHANGES } };
  // A global module that fixes the clock, so "today" is 2026-11-08 and the days in the answer are known.
  class FixedClockModule {}
  Global()(FixedClockModule);
  Module({ providers: [{ provide: ACTIVITY_NOW, useValue: () => new Date('2026-11-08T15:00:00Z') }], exports: [ACTIVITY_NOW] })(FixedClockModule);
  const app = await createAuthApp(t, store, { imports: [FixedClockModule, InsightsModule] });
  return { store, ...app };
}
async function login(server, name) {
  return (await request(server).post('/api/auth/login').set('Origin', ORIGIN).send({ login: name, password: PASSWORD }).expect(200)).body.accessToken;
}
const as = (call, token, company = '1') => call.set('Authorization', `Bearer ${token}`).set('X-Organization-Id', company);
const insightRows = (store) => store.auditEntries.filter((entry) => entry.module === 'insights');

// Every key name, however deep.
function keysOf(value, found = []) {
  if (Array.isArray(value)) value.forEach((item) => keysOf(item, found));
  else if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) { found.push(key); keysOf(inner, found); }
  return found;
}

test('an admin gets the insights of their own company, with exactly the documented keys', async (t) => {
  const { server, store } = await insightsApp(t);
  const lina = await login(server, 'lina');
  const body = (await as(request(server).get('/api/activity-insights?range=7'), lina).expect(200)).body;
  assert.deepEqual(Object.keys(body).sort(), TOP_KEYS);
  assert.equal(body.range, 7);
  assert.equal(body.visits, 11);
  assert.deepEqual(body.members, { active: 3, total: 4 });
  assert.deepEqual(body.security, CHANGES.security);
  // Seven UTC days ending today, both ends included, and the company is the verified one.
  assert.deepEqual(store.insightCalls, [['activity', '1', '2026-11-02', '2026-11-08'], ['changes', '1', '2026-11-02', '2026-11-08']]);
  assert.equal(body.from, '2026-11-02');
  assert.equal(body.to, '2026-11-08');
});

test('the response holds no field that names a person or where they connected from', async (t) => {
  const { server } = await insightsApp(t);
  const lina = await login(server, 'lina');
  const body = (await as(request(server).get('/api/activity-insights'), lina).expect(200)).body;
  // roleName and roleCode name a role, not a person, and passwordResets is a count, so they are fine.
  const personal = ['username', 'userId', 'user', 'name', 'displayName', 'email', 'ip', 'ipAddress', 'userAgent', 'oldValues', 'newValues', 'actor', 'actorName'];
  assert.deepEqual(keysOf(body).filter((key) => personal.includes(key)), []);
});

test('a missing range is 30 days, and other values are refused with 400', async (t) => {
  const { server, store } = await insightsApp(t);
  const lina = await login(server, 'lina');
  assert.equal((await as(request(server).get('/api/activity-insights'), lina).expect(200)).body.range, 30);
  assert.deepEqual(store.insightCalls[0], ['activity', '1', '2026-10-10', '2026-11-08']);
  for (const range of ['14', 'abc', '0', '-7', '7.5', '7;8']) {
    await as(request(server).get(`/api/activity-insights?range=${range}`), lina).expect(400);
  }
  store.insightCalls.length = 0;
  await as(request(server).get('/api/activity-insights?range=90'), lina).expect(200);
  assert.deepEqual(store.insightCalls[0], ['activity', '1', '2026-08-11', '2026-11-08']);
});

test('a successful read is audited once, with the range', async (t) => {
  const { server, store } = await insightsApp(t);
  const lina = await login(server, 'lina');
  await as(request(server).get('/api/activity-insights?range=90'), lina).expect(200);
  assert.deepEqual(insightRows(store), [{ module: 'insights', action: 'read', resourceType: 'activity_insight', params: { range: 90 } }]);
});

test('someone without the permission gets 403 and the attempt is audited as denied in their company', async (t) => {
  const { server, store } = await insightsApp(t);
  const dana = await login(server, 'dana');
  await as(request(server).get('/api/activity-insights'), dana).expect(403);
  assert.deepEqual(insightRows(store), [{ module: 'insights', action: 'read', resourceType: 'activity_insight', outcome: 'denied', organizationId: '1' }]);
  assert.deepEqual(store.insightCalls, []);
});

test('no token is 401 and leaves no audit row', async (t) => {
  const { server, store } = await insightsApp(t);
  await request(server).get('/api/activity-insights').set('X-Organization-Id', '1').expect(401);
  assert.deepEqual(insightRows(store), []);
});

test('the company is the verified header company, never a query value', async (t) => {
  const { server, store } = await insightsApp(t);
  store.insightResults['2'] = { activity: { ...ACTIVITY, visits: 99 }, changes: CHANGES };
  const lina = await login(server, 'lina');
  // Lina is an admin at Meridian only. Naming Harbor in the header is refused, and a company in the query is refused too.
  await as(request(server).get('/api/activity-insights'), lina, '2').expect(403);
  await as(request(server).get('/api/activity-insights?organizationId=2'), lina, '1').expect(400);
  const body = (await as(request(server).get('/api/activity-insights'), lina, '1').expect(200)).body;
  assert.equal(body.visits, 11);
  assert.ok(store.insightCalls.every(([, company]) => company === '1'));
  // Harbor's own admin sees Harbor's numbers only when they name Harbor.
  const karim = await login(server, 'karim');
  assert.equal((await as(request(server).get('/api/activity-insights'), karim, '2').expect(200)).body.visits, 99);
});
