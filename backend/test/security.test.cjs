require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Controller, Get, Req } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const { Reflector } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const request = require('supertest');
const { JwtAuthGuard } = require('../dist/modules/auth/jwt-auth.guard');
const { RolesGuard } = require('../dist/modules/rbac/roles.guard');
const { Public } = require('../dist/common/decorators/public.decorator');
const { RequirePermission } = require('../dist/common/decorators/require-permission.decorator');
const { TenantContextInterceptor } = require('../dist/common/interceptors/tenant-context.interceptor');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const { validateEnvironment } = require('../dist/common/config/environment');

test('HTTP authorization enforces authentication, membership, permissions, and explicit access', async (t) => {
  class FixtureController {
    public() { return { status: 'ok' }; }
    private(req) { return req.tenant; }
    undeclared() { return { secret: true }; }
    duplicate() { throw { errno: 1062, sql: 'SECRET SQL', message: 'raw database details' }; }
  }
  Controller()(FixtureController);
  for (const name of ['public', 'private', 'undeclared', 'duplicate']) {
    const descriptor = Object.getOwnPropertyDescriptor(FixtureController.prototype, name);
    Get(name)(FixtureController.prototype, name, descriptor);
    if (name === 'public' || name === 'duplicate') Public()(FixtureController.prototype, name, descriptor);
    if (name === 'private') RequirePermission('parcels.view')(FixtureController.prototype, name, descriptor);
  }
  Req()(FixtureController.prototype, 'private', 0);
  const module = await Test.createTestingModule({ controllers: [FixtureController] }).compile();
  const app = module.createNestApplication({ logger: false });
  const reflector = new Reflector();
  const jwt = new JwtService({ secret: 'test-secret-with-at-least-32-characters', signOptions: { issuer: 'transcend', audience: 'transcend-web', algorithm: 'HS256' }, verifyOptions: { issuer: 'transcend', audience: 'transcend-web', algorithms: ['HS256'] } });
  let scope = 'all';
  const members = { async requireActiveMembership(userId, organizationId) {
    if (organizationId !== '1') throw new (require('@nestjs/common').ForbiddenException)('Inactive membership');
    assert.equal(userId, '7');
    return { organizationId, roleId: '3' };
  } };
  const permissions = { async findScope(roleId, permission) { assert.equal(roleId, '3'); assert.equal(permission, 'parcels.view'); return scope; } };
  app.useGlobalGuards(new JwtAuthGuard(reflector, jwt), new RolesGuard(reflector, members, permissions));
  app.useGlobalInterceptors(new TenantContextInterceptor(reflector));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  t.after(() => app.close());
  const server = app.getHttpServer();
  const token = jwt.sign({ sub: '7' }, { expiresIn: '15m' });
  const authorized = () => request(server).get('/private').set('Authorization', `Bearer ${token}`).set('X-Organization-Id', '1');

  await request(server).get('/public').expect(200);
  await request(server).get('/private').expect(401);
  await request(server).get('/private').set('Authorization', 'Bearer malformed').expect(401);
  await request(server).get('/private').set('Authorization', `Bearer ${jwt.sign({ sub: '7' }, { expiresIn: -1 })}`).expect(401);
  await request(server).get('/private').set('Authorization', `Bearer ${jwt.sign({ sub: '7' })}`).expect(401);
  await request(server).get('/private').set('Authorization', `Bearer ${token}`).expect(400);
  await request(server).get('/private').set('Authorization', `Bearer ${token}`).set('X-Organization-Id', '2').expect(403);
  await request(server).get('/undeclared').set('Authorization', `Bearer ${token}`).expect(403);
  const success = await authorized().expect(200);
  assert.deepEqual(success.body, { organizationId: '1', roleId: '3' });
  scope = undefined;
  await authorized().expect(403);
  scope = 'assigned_only';
  await authorized().expect(403);
  const duplicate = await request(server).get('/duplicate').expect(409);
  assert.equal(duplicate.body.message, 'A record with those unique details already exists.');
  assert.ok(!JSON.stringify(duplicate.body).includes('SECRET SQL'));
});

test('invalid environment errors identify fields without exposing values', () => {
  assert.throws(() => validateEnvironment({ JWT_SECRET: 'private-secret' }), (error) => error.message.includes('JWT_SECRET') && !error.message.includes('private-secret'));
});
