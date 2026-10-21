require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Controller, Get, Req } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const { Authenticated } = require('../dist/common/decorators/authenticated.decorator');
const { PlatformAdmin } = require('../dist/common/decorators/platform-admin.decorator');
const { RequirePermission } = require('../dist/common/decorators/require-permission.decorator');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const { TenantContextInterceptor } = require('../dist/common/interceptors/tenant-context.interceptor');
const { JwtAuthGuard } = require('../dist/modules/auth/jwt-auth.guard');
const { RolesGuard } = require('../dist/modules/rbac/roles.guard');

class PlatformFixtureController {
  tenants(request) { return { userId: request.user.id, tenant: request.tenant ?? null }; }
  withPermission() { return { secret: true }; }
  withAuthenticated() { return { secret: true }; }
}
Controller('platform-fixture')(PlatformFixtureController);
for (const [name, path] of [['tenants', 'tenants'], ['withPermission', 'with-permission'], ['withAuthenticated', 'with-authenticated']]) {
  const descriptor = Object.getOwnPropertyDescriptor(PlatformFixtureController.prototype, name);
  Get(path)(PlatformFixtureController.prototype, name, descriptor);
  PlatformAdmin()(PlatformFixtureController.prototype, name, descriptor);
  if (name === 'withPermission') RequirePermission('parcels.view')(PlatformFixtureController.prototype, name, descriptor);
  if (name === 'withAuthenticated') Authenticated()(PlatformFixtureController.prototype, name, descriptor);
}
Req()(PlatformFixtureController.prototype, 'tenants', 0);

// The decorator on the class covers every route in it.
class WholePlatformController {
  activity() { return { ok: true }; }
}
Controller('platform-class')(WholePlatformController);
PlatformAdmin()(WholePlatformController);
Get('activity')(WholePlatformController.prototype, 'activity', Object.getOwnPropertyDescriptor(WholePlatformController.prototype, 'activity'));

test('@PlatformAdmin() needs the platform role, never a company, and refuses being combined', async (t) => {
  // 7: platform admin; 8: org_admin of company 1 only; 9: platform admin whose account is deactivated.
  const active = new Set(['7', '8']);
  const platformAdmins = new Set(['7', '9']);
  const membershipChecks = [];
  const users = { isActive: async (id) => active.has(id) };
  const members = { async requireActiveMembership(userId, organizationId) {
    membershipChecks.push([userId, organizationId]);
    return { organizationId, roleId: '2' };
  } };
  const permissions = { findScope: async () => 'all' };
  const platformRoles = { hasPlatformAccess: async (id) => platformAdmins.has(id) };
  const moduleRef = await Test.createTestingModule({ controllers: [PlatformFixtureController, WholePlatformController] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  const reflector = new Reflector();
  const jwt = new JwtService({ secret: 'test-secret-with-at-least-32-characters' });
  app.useGlobalGuards(new JwtAuthGuard(reflector, jwt), new RolesGuard(reflector, members, permissions, users, platformRoles));
  app.useGlobalInterceptors(new TenantContextInterceptor(reflector));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  t.after(() => app.close());
  const server = app.getHttpServer();
  const get = (path, userId) => request(server).get(path).set('Authorization', `Bearer ${jwt.sign({ sub: userId }, { expiresIn: '15m' })}`);

  // A platform admin gets in without a company, and a company header changes nothing.
  assert.deepEqual((await get('/platform-fixture/tenants', '7').expect(200)).body, { userId: '7', tenant: null });
  assert.deepEqual((await get('/platform-fixture/tenants', '7').set('X-Organization-Id', '1').expect(200)).body, { userId: '7', tenant: null });
  assert.deepEqual(membershipChecks, []);

  // A company admin with a company header is still not a platform admin.
  const companyAdmin = await get('/platform-fixture/tenants', '8').set('X-Organization-Id', '1').expect(403);
  assert.equal(companyAdmin.body.code, 'PLATFORM_ACCESS_REQUIRED');
  await get('/platform-fixture/tenants', '9').expect(403);
  await request(server).get('/platform-fixture/tenants').expect(401);

  // Combining it with the other two is a programming error.
  await get('/platform-fixture/with-permission', '7').set('X-Organization-Id', '1').expect(403);
  await get('/platform-fixture/with-authenticated', '7').expect(403);

  await get('/platform-class/activity', '7').expect(200);
  assert.equal((await get('/platform-class/activity', '8').expect(403)).body.code, 'PLATFORM_ACCESS_REQUIRED');
});
