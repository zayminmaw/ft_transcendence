require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Controller, Get, Req } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const { Authenticated } = require('../dist/common/decorators/authenticated.decorator');
const { RequirePermission } = require('../dist/common/decorators/require-permission.decorator');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const { TenantContextInterceptor } = require('../dist/common/interceptors/tenant-context.interceptor');
const { JwtAuthGuard } = require('../dist/modules/auth/jwt-auth.guard');
const { RolesGuard } = require('../dist/modules/rbac/roles.guard');

class AccountFixtureController {
  account(request) { return { userId: request.user.id, tenant: request.tenant ?? null }; }
  company(request) { return request.tenant; }
  undeclared() { return { secret: true }; }
  both() { return { secret: true }; }
}
Controller('fixture')(AccountFixtureController);
for (const name of ['account', 'company', 'undeclared', 'both']) {
  const descriptor = Object.getOwnPropertyDescriptor(AccountFixtureController.prototype, name);
  Get(name)(AccountFixtureController.prototype, name, descriptor);
  if (name === 'account' || name === 'both') Authenticated()(AccountFixtureController.prototype, name, descriptor);
  if (name === 'company' || name === 'both') RequirePermission('parcels.view')(AccountFixtureController.prototype, name, descriptor);
}
Req()(AccountFixtureController.prototype, 'account', 0);
Req()(AccountFixtureController.prototype, 'company', 0);

test('@Authenticated() needs an active user but no company, and the other guards stay strict', async (t) => {
  const active = new Set(['7']);
  const users = { isActive: async (id) => active.has(id) };
  const members = { async requireActiveMembership(userId, organizationId) {
    if (organizationId !== '1') throw new (require('@nestjs/common').ForbiddenException)('Inactive membership');
    return { organizationId, roleId: '3' };
  } };
  const permissions = { findScope: async () => 'all' };
  const moduleRef = await Test.createTestingModule({ controllers: [AccountFixtureController] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  const reflector = new Reflector();
  const jwt = new JwtService({ secret: 'test-secret-with-at-least-32-characters' });
  app.useGlobalGuards(new JwtAuthGuard(reflector, jwt), new RolesGuard(reflector, members, permissions, users));
  app.useGlobalInterceptors(new TenantContextInterceptor(reflector));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  t.after(() => app.close());
  const server = app.getHttpServer();
  const get = (path, userId = '7') => request(server).get(`/fixture/${path}`).set('Authorization', `Bearer ${jwt.sign({ sub: userId }, { expiresIn: '15m' })}`);

  assert.deepEqual((await get('account').expect(200)).body, { userId: '7', tenant: null });
  await request(server).get('/fixture/account').expect(401);
  await get('account', '8').expect(403);
  await get('undeclared').expect(403);
  await get('both').expect(403);
  await get('company').expect(400);
  await get('company').set('X-Organization-Id', '2').expect(403);
  assert.deepEqual((await get('company').set('X-Organization-Id', '1').expect(200)).body, { organizationId: '1', roleId: '3' });
});
