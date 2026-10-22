const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Controller, Get } = require('@nestjs/common');
const request = require('supertest');
const { RequirePermission } = require('../dist/common/decorators/require-permission.decorator');
const { hashPassword } = require('../dist/modules/users/password');
const { ORIGIN, createAuthApp, createFakeStore, refreshCookie } = require('./helpers/auth-app.cjs');

// The cookie's Secure flag depends on NODE_ENV; pin it like auth.test.cjs.
process.env.NODE_ENV = 'test';

const TEMPORARY = 'Temporary-pass-1';
const CHOSEN = 'Chosen-by-me-2';

// A company endpoint, to show what a must-change account can't reach yet.
class CompanyFixtureController {
  parcels() { return { ok: true }; }
}
Controller('fixture')(CompanyFixtureController);
const parcels = Object.getOwnPropertyDescriptor(CompanyFixtureController.prototype, 'parcels');
Get('parcels')(CompanyFixtureController.prototype, 'parcels', parcels);
RequirePermission('parcels.view')(CompanyFixtureController.prototype, 'parcels', parcels);

async function newHireApp(t) {
  const store = createFakeStore();
  store.users.push({
    id: '5', username: 'new.hire', email: 'new.hire@meridian.example.test', passwordHash: await hashPassword(TEMPORARY), isActive: true, mustChangePassword: true,
  });
  store.memberships.push({ organizationId: '1', userId: '5', roleId: '3', isActive: true });
  store.rolePermissions.set('3', new Set(['parcels.view']));
  return { store, ...(await createAuthApp(t, store, { controllers: [CompanyFixtureController] })) };
}

const login = (server, password = TEMPORARY) => request(server).post('/api/auth/login').set('Origin', ORIGIN).send({ login: 'new.hire', password });
const bearer = (call, token) => call.set('Authorization', `Bearer ${token}`);
const companyParcels = (server, token) => bearer(request(server).get('/api/fixture/parcels'), token).set('X-Organization-Id', '1');
const changePassword = (server, token, body, cookie) => {
  const call = bearer(request(server).post('/api/auth/password'), token).send(body);
  return cookie ? call.set('Cookie', `transcend_refresh=${encodeURIComponent(cookie)}`) : call;
};

test('an account that must change its password gets a flagged token and only reaches /me and /auth/password', async (t) => {
  const { server, jwt } = await newHireApp(t);
  const loggedIn = await login(server).expect(200);
  const { accessToken } = loggedIn.body;
  assert.equal((await jwt.verifyAsync(accessToken)).mustChangePassword, true);
  assert.equal((await companyParcels(server, accessToken).expect(403)).body.code, 'AUTH_PASSWORD_CHANGE_REQUIRED');
  assert.equal((await bearer(request(server).get('/api/auth/me'), accessToken).expect(200)).body.mustChangePassword, true);
  // A refresh keeps the flag until the password changes.
  const refreshed = await request(server).post('/api/auth/refresh').set('Origin', ORIGIN)
    .set('Cookie', `transcend_refresh=${encodeURIComponent(refreshCookie(loggedIn).value)}`).expect(200);
  assert.equal((await jwt.verifyAsync(refreshed.body.accessToken)).mustChangePassword, true);
});

test('changing the password clears the flag, keeps this session and ends the others', async (t) => {
  const { server, store, jwt } = await newHireApp(t);
  await login(server).expect(200);
  const laptop = await login(server).expect(200);
  const changed = await changePassword(server, laptop.body.accessToken, { currentPassword: TEMPORARY, newPassword: CHOSEN }, refreshCookie(laptop).value).expect(200);
  assert.equal((await jwt.verifyAsync(changed.body.accessToken)).mustChangePassword, undefined);
  await companyParcels(server, changed.body.accessToken).expect(200);
  assert.equal(store.users[0].mustChangePassword, false);
  assert.deepEqual(store.sessions.map((session) => session.revokedReason), ['password_change', null]);
  assert.deepEqual(store.audit.map((entry) => entry.action), ['login', 'login', 'password_changed']);
  await login(server, TEMPORARY).expect(401);
  await login(server, CHOSEN).expect(200);
});

test('the current password must be right, and the new one must pass the rule and be different', async (t) => {
  const { server, store } = await newHireApp(t);
  const { accessToken } = (await login(server).expect(200)).body;
  const refused = async (body, status, code) => assert.equal((await changePassword(server, accessToken, body).expect(status)).body.code, code);
  await refused({ currentPassword: 'Wrong-pass-1', newPassword: CHOSEN }, 400, 'AUTH_WRONG_PASSWORD');
  await refused({ currentPassword: TEMPORARY, newPassword: 'weakpassword' }, 400, 'PASSWORD_RULE');
  await refused({ currentPassword: TEMPORARY, newPassword: TEMPORARY }, 400, 'PASSWORD_UNCHANGED');
  await request(server).post('/api/auth/password').send({ currentPassword: TEMPORARY, newPassword: CHOSEN }).expect(401);
  assert.equal(store.users[0].mustChangePassword, true);
});

test('password changes are limited to 5 a minute per account', async (t) => {
  const { server } = await newHireApp(t);
  const { accessToken } = (await login(server).expect(200)).body;
  for (let attempt = 1; attempt <= 5; attempt++) await changePassword(server, accessToken, { currentPassword: 'Wrong-pass-1', newPassword: CHOSEN }).expect(400);
  const blocked = await changePassword(server, accessToken, { currentPassword: TEMPORARY, newPassword: CHOSEN }).expect(429);
  assert.equal(blocked.body.code, 'AUTH_TOO_MANY_ATTEMPTS');
});
