require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { ConfigModule } = require('@nestjs/config');
const { Reflector } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { Test } = require('@nestjs/testing');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { configureApp } = require('../dist/app.setup');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const { TenantContextInterceptor } = require('../dist/common/interceptors/tenant-context.interceptor');
const { JwtAuthGuard } = require('../dist/modules/auth');
const { AuthAuditRepository } = require('../dist/modules/auth/auth-audit.repository');
const { AuditLog } = require('../dist/modules/audit/entities/audit-log.entity');
const { UserSession } = require('../dist/modules/auth/entities/user-session.entity');
const { SessionsRepository } = require('../dist/modules/auth/sessions.repository');
const { FortyTwoModule } = require('../dist/modules/forty-two');
const { FortyTwoApi } = require('../dist/modules/forty-two/forty-two-api');
const { OrganizationMember } = require('../dist/modules/organizations/entities/organization-member.entity');
const { OrganizationMembersRepository } = require('../dist/modules/organizations/organization-members.repository');
const { RolesGuard } = require('../dist/modules/rbac');
const { RolePermission } = require('../dist/modules/rbac/entities/role-permission.entity');
const { UserRole } = require('../dist/modules/rbac/entities/user-role.entity');
const { PermissionsRepository } = require('../dist/modules/rbac/permissions.repository');
const { PlatformRolesRepository } = require('../dist/modules/rbac/platform-roles.repository');
const { User } = require('../dist/modules/users/entities/user.entity');
const { UsersRepository } = require('../dist/modules/users/users.repository');
const { ORIGIN, createFakeStore, refreshCookie } = require('./helpers/auth-app.cjs');

// The cookies' Secure flag depends on NODE_ENV; pin it so a run in the development container checks the same flags.
process.env.NODE_ENV = 'test';

const BASE_ENV = { JWT_SECRET: 'test-secret-with-at-least-32-characters', JWT_ISSUER: 'transcend', JWT_AUDIENCE: 'transcend-web', CORS_ORIGIN: ORIGIN };
const CONFIGURED = { ...BASE_ENV, FORTYTWO_APP_ID: 'u-test-client', FORTYTWO_APP_SECRET: 's-test-secret' };
const ENTITIES = [User, OrganizationMember, UserRole, RolePermission, UserSession, AuditLog];

// A stand-in for the 42 API: answers with the given email, or throws like a refused or timed-out call.
function fakeApi({ email = 'dana@meridian.example.test', fail = false } = {}) {
  const calls = [];
  return {
    calls,
    exchangeCode: async (code, credentials) => {
      calls.push({ code, credentials });
      if (fail) throw new Error('refused');
      return 'access-token';
    },
    fetchEmail: async (token) => {
      assert.equal(token, 'access-token');
      return email;
    },
  };
}

async function createApp(t, { env = CONFIGURED, api = fakeApi() } = {}) {
  const store = createFakeStore();
  store.users.push(
    { id: '2', username: 'dana.saleh', email: 'dana@meridian.example.test', passwordHash: 'unused', isActive: true },
    { id: '3', username: 'ex.member', email: 'ex@meridian.example.test', passwordHash: 'unused', isActive: false },
  );
  let builder = Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => env] }), FortyTwoModule],
  });
  for (const entity of ENTITIES) builder = builder.overrideProvider(getRepositoryToken(entity)).useValue({});
  const moduleRef = await builder
    .overrideProvider(FortyTwoApi).useValue(api)
    .overrideProvider(UsersRepository).useValue(store.repositories.users)
    .overrideProvider(SessionsRepository).useValue(store.repositories.sessions)
    .overrideProvider(AuthAuditRepository).useValue(store.repositories.audit)
    .overrideProvider(OrganizationMembersRepository).useValue(store.repositories.members)
    .overrideProvider(PermissionsRepository).useValue(store.repositories.permissions)
    .overrideProvider(PlatformRolesRepository).useValue(store.repositories.platformRoles)
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, ORIGIN);
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector, app.get(JwtService)), app.get(RolesGuard));
  app.useGlobalInterceptors(new TenantContextInterceptor(reflector));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  t.after(() => app.close());
  return { server: app.getHttpServer(), store, api, jwt: app.get(JwtService) };
}

function stateCookie(response) {
  const header = (response.headers['set-cookie'] ?? []).find((cookie) => cookie.startsWith('transcend_42_state='));
  return header && { header, value: decodeURIComponent(header.split(';')[0].slice('transcend_42_state='.length)) };
}

// Starts a login and returns the state 42 would send back, plus the cookie the browser would hold.
async function start(server) {
  const response = await request(server).get('/api/auth/42').expect(302);
  return { response, state: stateCookie(response).value };
}

const callback = (server, query, state) => {
  const call = request(server).get('/api/auth/42/callback').query(query);
  return state ? call.set('Cookie', `transcend_42_state=${encodeURIComponent(state)}`) : call;
};

test('start redirects to 42 with the client id, callback URL and a state kept in a Lax cookie', async (t) => {
  const { server } = await createApp(t);
  const { response, state } = await start(server);
  const location = new URL(response.headers.location);
  assert.equal(location.origin + location.pathname, 'https://api.intra.42.fr/oauth/authorize');
  assert.equal(location.searchParams.get('client_id'), 'u-test-client');
  assert.equal(location.searchParams.get('redirect_uri'), `${ORIGIN}/api/auth/42/callback`);
  assert.equal(location.searchParams.get('response_type'), 'code');
  assert.equal(location.searchParams.get('state'), state);
  assert.ok(state.length >= 43);
  const { header } = stateCookie(response);
  assert.match(header, /; Path=\/api\/auth\/42/);
  assert.match(header, /; HttpOnly/);
  assert.match(header, /; SameSite=Lax/);
  assert.match(header, /; Secure/);
  assert.doesNotMatch(response.headers.location, /s-test-secret/);
});

test('a matching active email logs in exactly like password login and lands in /app', async (t) => {
  const { server, store, api, jwt } = await createApp(t, { api: fakeApi({ email: 'DANA@Meridian.example.test' }) });
  const { state } = await start(server);
  const response = await callback(server, { code: 'the-code', state }, state).expect(302);
  assert.equal(response.headers.location, '/app');
  assert.equal(api.calls[0].code, 'the-code');
  assert.equal(api.calls[0].credentials.redirectUri, `${ORIGIN}/api/auth/42/callback`);
  const cookie = refreshCookie(response);
  assert.match(cookie.header, /; Path=\/api\/auth/);
  assert.match(cookie.header, /; HttpOnly/);
  assert.match(cookie.header, /; SameSite=Strict/);
  assert.equal(store.sessionFor(cookie.value).userId, '2');
  assert.deepEqual(store.lastLogins, ['2']);
  assert.deepEqual(store.audit.map(({ action, userId }) => ({ action, userId })), [{ action: 'login', userId: '2' }]);
  assert.match(stateCookie(response).header, /transcend_42_state=;/);
  // The session works with the existing refresh endpoint.
  const refreshed = await request(server).post('/api/auth/refresh').set('Origin', ORIGIN)
    .set('Cookie', `transcend_refresh=${encodeURIComponent(cookie.value)}`).expect(200);
  assert.equal((await jwt.verifyAsync(refreshed.body.accessToken)).sub, '2');
});

test('an email with no account, or an inactive account, gets no session', async (t) => {
  for (const email of ['stranger@student.42.fr', 'ex@meridian.example.test']) {
    const { server, store } = await createApp(t, { api: fakeApi({ email }) });
    const { state } = await start(server);
    const response = await callback(server, { code: 'the-code', state }, state).expect(302);
    assert.equal(response.headers.location, '/login?oauth=no_account');
    assert.equal(refreshCookie(response), undefined);
    assert.equal(store.sessions.length, 0);
    assert.deepEqual(store.audit.map(({ action }) => action), ['login_failed']);
  }
});

test('a missing or different state is refused before 42 is called', async (t) => {
  const { server, store, api } = await createApp(t);
  const { state } = await start(server);
  for (const response of [
    await callback(server, { code: 'the-code', state }),
    await callback(server, { code: 'the-code', state: 'forged' }, state),
    await callback(server, { code: 'the-code' }, state),
    await callback(server, { state }, state),
  ]) {
    assert.equal(response.status, 302);
    assert.equal(response.headers.location, '/login?oauth=failed');
    assert.equal(refreshCookie(response), undefined);
  }
  assert.equal(api.calls.length, 0);
  assert.equal(store.sessions.length, 0);
});

test('declining on 42 and a failing 42 API each return to login with their reason', async (t) => {
  const denied = await createApp(t);
  const first = await start(denied.server);
  const declined = await callback(denied.server, { error: 'access_denied', state: first.state }, first.state).expect(302);
  assert.equal(declined.headers.location, '/login?oauth=denied');

  const broken = await createApp(t, { api: fakeApi({ fail: true }) });
  const second = await start(broken.server);
  const failed = await callback(broken.server, { code: 'the-code', state: second.state }, second.state).expect(302);
  assert.equal(failed.headers.location, '/login?oauth=failed');
  assert.equal(broken.store.sessions.length, 0);
});

test('without 42 credentials both endpoints answer unavailable', async (t) => {
  const { server } = await createApp(t, { env: BASE_ENV });
  const started = await request(server).get('/api/auth/42').expect(302);
  assert.equal(started.headers.location, '/login?oauth=unavailable');
  assert.equal(stateCookie(started), undefined);
  const finished = await callback(server, { code: 'the-code', state: 'x' }, 'x').expect(302);
  assert.equal(finished.headers.location, '/login?oauth=unavailable');
});
