const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Controller, Get } = require('@nestjs/common');
const request = require('supertest');
const { RequirePermission } = require('../dist/common/decorators/require-permission.decorator');
const { MembersModule } = require('../dist/modules/members');
const { hashPassword, passwordProblems } = require('../dist/modules/users/password');
const { ORIGIN, PASSWORD, as, createAuthApp, createFakeStore, tokenFor } = require('./helpers/auth-app.cjs');

process.env.NODE_ENV = 'test';

// A company endpoint, to show that a deactivated member loses access at once.
class CompanyFixtureController {
  parcels() { return { ok: true }; }
}
Controller('fixture')(CompanyFixtureController);
const parcels = Object.getOwnPropertyDescriptor(CompanyFixtureController.prototype, 'parcels');
Get('parcels')(CompanyFixtureController.prototype, 'parcels', parcels);
RequirePermission('parcels.view')(CompanyFixtureController.prototype, 'parcels', parcels);

// Meridian (company 1) and Harbor (company 2).
async function meridianApp(t) {
  const passwordHash = await hashPassword(PASSWORD);
  const store = createFakeStore();
  store.roles.push(
    { id: 1, code: 'org_admin', name: 'Organization Admin', description: 'Runs the company' },
    { id: 2, code: 'dispatcher', name: 'Dispatcher', description: 'Assigns parcels' },
    { id: 3, code: 'finance', name: 'Finance', description: 'Money' },
    { id: 9, code: 'platform_admin', name: 'Platform Admin', description: 'Platform' },
  );
  store.rolePermissions.set('1', new Set(['admin.manage_users', 'admin.manage_roles', 'admin.audit_logs']));
  store.rolePermissions.set('2', new Set(['parcels.view']));
  store.rolePermissions.set('3', new Set(['billing.view']));
  const people = [
    ['10', 'lina', '1', '1'], ['12', 'dana.saleh', '1', '2'],
    ['13', 'noor', '1', '2'], ['14', 'zara.platform', '1', '2'], ['15', 'karim.harbor', '2', '1'],
  ];
  for (const [id, username, organizationId, roleId] of people) {
    store.users.push({ id, username, email: `${username}@demo.example.test`, passwordHash, isActive: true, lastLoginAt: null });
    store.memberships.push({ organizationId, userId: id, roleId, isActive: true });
  }
  store.memberships.push({ organizationId: '2', userId: '13', roleId: '2', isActive: false });
  store.platformAdmins.add('14');
  return { store, ...(await createAuthApp(t, store, { controllers: [CompanyFixtureController], imports: [MembersModule] })) };
}

test('the people list and the roles you may give, for admins only', async (t) => {
  const { server } = await meridianApp(t);
  const lina = await tokenFor(server, 'lina');
  const list = (await as(request(server).get('/api/members'), lina).expect(200)).body;
  assert.deepEqual(list.map((member) => member.username), ['dana.saleh', 'lina', 'noor', 'zara.platform']);
  assert.deepEqual(list[0], {
    userId: '12', username: 'dana.saleh', email: 'dana.saleh@demo.example.test', role: { code: 'dispatcher', name: 'Dispatcher' },
    isActive: true, lastLoginAt: null, mustChangePassword: false,
  });
  const codes = async (token) => (await as(request(server).get('/api/members/assignable-roles'), token).expect(200)).body.map((role) => role.code);
  // Every company role except platform_admin, sorted by name for the dropdown.
  assert.deepEqual(await codes(lina), ['dispatcher', 'finance', 'org_admin']);
  // Await the token first: supertest closes its temporary server when each request ends.
  const dana = await tokenFor(server, 'dana.saleh');
  await as(request(server).get('/api/members'), dana).expect(403);
  await request(server).get('/api/members').set('Authorization', `Bearer ${lina}`).expect(400);
});

test('creating a member makes an account that must change its password, in the company from the header', async (t) => {
  const { server, store, jwt } = await meridianApp(t);
  const lina = await tokenFor(server, 'lina');
  const created = await as(request(server).post('/api/members'), lina)
    .send({ username: 'new.hire', email: 'new.hire@meridian.example.test', password: 'Initial-pass-1', roleCode: 'dispatcher' }).expect(201);
  assert.deepEqual(created.body, {
    userId: '100', username: 'new.hire', email: 'new.hire@meridian.example.test', role: { code: 'dispatcher', name: 'Dispatcher' },
    isActive: true, lastLoginAt: null, mustChangePassword: true,
  });
  assert.deepEqual(store.memberships.at(-1), { organizationId: '1', userId: '100', roleId: '2', isActive: true });
  assert.deepEqual(store.audit.at(-1), { action: 'member_created', organizationId: '1', actorId: '10', targetId: '100', targetName: 'new.hire', newValues: { role: 'dispatcher' } });
  // The new person logs in with the admin-given password and must change it first.
  assert.equal((await jwt.verifyAsync(await tokenFor(server, 'new.hire', 'Initial-pass-1'))).mustChangePassword, true);
  // The company comes from the verified header, never from the body.
  await as(request(server).post('/api/members'), lina)
    .send({ username: 'other.hire', email: 'other@meridian.example.test', password: 'Initial-pass-1', roleCode: 'dispatcher', organizationId: '2' })
    .expect(400);
});

test('creating refuses roles you may not give, taken names and invalid details', async (t) => {
  const { server } = await meridianApp(t);
  const lina = await tokenFor(server, 'lina');
  const create = (token, body) => as(request(server).post('/api/members'), token)
    .send({ username: 'new.hire', email: 'new.hire@meridian.example.test', password: 'Initial-pass-1', roleCode: 'dispatcher', ...body });
  const code = async (call, status) => (await call.expect(status)).body.code;
  assert.equal(await code(create(lina, { roleCode: 'platform_admin' }), 403), 'ROLE_NOT_ASSIGNABLE');
  assert.equal(await code(create(lina, { roleCode: 'no_such_role' }), 403), 'ROLE_NOT_ASSIGNABLE');
  assert.equal(await code(create(lina, { username: 'DANA.SALEH' }), 409), 'MEMBER_TAKEN');
  assert.equal(await code(create(lina, { email: 'Lina@Demo.Example.Test' }), 409), 'MEMBER_TAKEN');
  assert.equal(await code(create(lina, { password: 'weakpassword' }), 400), 'PASSWORD_RULE');
  assert.equal(await code(create(lina, { username: 'new hire' }), 400), 'INVALID_USERNAME');
  assert.equal(await code(create(lina, { email: 'dána@meridian.example.test' }), 400), 'INVALID_EMAIL');
});

test('deactivating ends access to this company at once; reactivating brings it back', async (t) => {
  const { server, store } = await meridianApp(t);
  const lina = await tokenFor(server, 'lina');
  const dana = await tokenFor(server, 'dana.saleh');
  store.rolePermissions.get('2').add('parcels.view');
  await as(request(server).get('/api/fixture/parcels'), dana).expect(200);
  const off = await as(request(server).patch('/api/members/12'), lina).send({ isActive: false }).expect(200);
  assert.equal(off.body.isActive, false);
  await as(request(server).get('/api/fixture/parcels'), dana).expect(403);
  // Asking for the current state again changes nothing and writes no audit row.
  const rowsBefore = store.audit.length;
  await as(request(server).patch('/api/members/12'), lina).send({ isActive: false }).expect(200);
  assert.equal(store.audit.length, rowsBefore);
  await as(request(server).patch('/api/members/12'), lina).send({ isActive: true }).expect(200);
  await as(request(server).get('/api/fixture/parcels'), dana).expect(200);
  assert.deepEqual(store.audit.filter((entry) => entry.targetId === '12').map((entry) => entry.action), ['member_deactivated', 'member_reactivated']);
});

test('nobody can deactivate themselves or someone outside the company', async (t) => {
  const { server } = await meridianApp(t);
  const lina = await tokenFor(server, 'lina');
  const patch = (token, userId) => as(request(server).patch(`/api/members/${userId}`), token).send({ isActive: false });
  assert.equal((await patch(lina, '10').expect(403)).body.code, 'MEMBER_SELF');
  // karim belongs to Harbor only: from Meridian he looks the same as someone who doesn't exist.
  assert.equal((await patch(lina, '15').expect(404)).body.code, 'MEMBER_NOT_FOUND');
  assert.equal((await patch(lina, '999').expect(404)).body.code, 'MEMBER_NOT_FOUND');
  assert.equal((await patch(lina, 'abc').expect(404)).body.code, 'MEMBER_NOT_FOUND');
});

test('changing a role gives someone in the company another role, from their next request', async (t) => {
  const { server, store } = await meridianApp(t);
  const lina = await tokenFor(server, 'lina');
  const dana = await tokenFor(server, 'dana.saleh');
  await as(request(server).get('/api/fixture/parcels'), dana).expect(200);
  const changed = await as(request(server).patch('/api/members/12'), lina).send({ roleCode: 'finance' }).expect(200);
  assert.deepEqual(changed.body.role, { code: 'finance', name: 'Finance' });
  assert.deepEqual(store.memberships.find((row) => row.userId === '12'), { organizationId: '1', userId: '12', roleId: '3', isActive: true });
  assert.deepEqual(store.audit.at(-1), {
    action: 'member_role_changed', organizationId: '1', actorId: '10', targetId: '12', targetName: 'dana.saleh',
    newValues: { role: 'finance' }, oldValues: { role: 'dispatcher' },
  });
  // Finance has billing.view only here: dana's same token loses the parcels endpoint on its next request.
  await as(request(server).get('/api/fixture/parcels'), dana).expect(403);
  // The current role again changes nothing and writes no audit row.
  const rowsBefore = store.audit.length;
  await as(request(server).patch('/api/members/12'), lina).send({ roleCode: 'finance' }).expect(200);
  assert.equal(store.audit.length, rowsBefore);
});

test('changing a role is refused for yourself, outsiders, roles you may not give, and two changes at once', async (t) => {
  const { server } = await meridianApp(t);
  const lina = await tokenFor(server, 'lina');
  const patch = (userId, body) => as(request(server).patch(`/api/members/${userId}`), lina).send(body);
  assert.equal((await patch('10', { roleCode: 'dispatcher' }).expect(403)).body.code, 'MEMBER_SELF');
  assert.equal((await patch('15', { roleCode: 'dispatcher' }).expect(404)).body.code, 'MEMBER_NOT_FOUND');
  assert.equal((await patch('12', { roleCode: 'platform_admin' }).expect(403)).body.code, 'ROLE_NOT_ASSIGNABLE');
  assert.equal((await patch('12', { roleCode: 'no_such_role' }).expect(403)).body.code, 'ROLE_NOT_ASSIGNABLE');
  await patch('12', { roleCode: 'finance', isActive: false }).expect(400);
  await patch('12', {}).expect(400);
  // null is sent but is neither a boolean nor a role code.
  await patch('12', { isActive: null }).expect(400);
  await patch('12', { roleCode: null }).expect(400);
  // A role belongs to one membership: noor also has a Harbor membership, and that doesn't block this one.
  assert.equal((await patch('13', { roleCode: 'finance' }).expect(200)).body.role.code, 'finance');
  const dana = await tokenFor(server, 'dana.saleh');
  await as(request(server).patch('/api/members/13'), dana).send({ roleCode: 'dispatcher' }).expect(403);
});

test('the roles view: what each company role allows and how many people hold it here, for admin.manage_roles', async (t) => {
  const { server, store } = await meridianApp(t);
  const lina = await tokenFor(server, 'lina');
  const roles = (await as(request(server).get('/api/members/roles'), lina).expect(200)).body;
  assert.deepEqual(roles, [
    { code: 'org_admin', name: 'Organization Admin', members: 1, permissions: [
      { code: 'admin.manage_users', scope: 'all' }, { code: 'admin.manage_roles', scope: 'all' }, { code: 'admin.audit_logs', scope: 'all' },
    ] },
    { code: 'dispatcher', name: 'Dispatcher', members: 3, permissions: [{ code: 'parcels.view', scope: 'all' }] },
    { code: 'finance', name: 'Finance', members: 0, permissions: [{ code: 'billing.view', scope: 'all' }] },
  ]);
  const dana = await tokenFor(server, 'dana.saleh');
  await as(request(server).get('/api/members/roles'), dana).expect(403);
  // admin.manage_users opens the members list, not the roles view.
  store.rolePermissions.set('2', new Set(['admin.manage_users']));
  await as(request(server).get('/api/members'), dana).expect(200);
  await as(request(server).get('/api/members/roles'), dana).expect(403);
});

test('a reset gives a one-time password, forces a change and ends every session of that person', async (t) => {
  const { server, store, jwt } = await meridianApp(t);
  const lina = await tokenFor(server, 'lina');
  await tokenFor(server, 'dana.saleh');
  await tokenFor(server, 'dana.saleh');
  const { temporaryPassword } = (await as(request(server).post('/api/members/12/password-reset'), lina).expect(200)).body;
  assert.deepEqual(passwordProblems(temporaryPassword), []);
  assert.equal(store.users.find((user) => user.id === '12').mustChangePassword, true);
  assert.deepEqual(store.sessions.filter((session) => session.userId === '12').map((session) => session.revokedReason), ['password_reset', 'password_reset']);
  assert.deepEqual(store.audit.at(-1), { action: 'password_reset', organizationId: '1', actorId: '10', targetId: '12', targetName: 'dana.saleh', newValues: undefined });
  assert.doesNotMatch(JSON.stringify(store.audit), new RegExp(temporaryPassword.replace(/[^A-Za-z0-9]/g, '.')));
  await request(server).post('/api/auth/login').set('Origin', ORIGIN).send({ login: 'dana.saleh', password: PASSWORD }).expect(401);
  assert.equal((await jwt.verifyAsync(await tokenFor(server, 'dana.saleh', temporaryPassword))).mustChangePassword, true);
});

test('a reset is refused for yourself and for accounts used outside this company', async (t) => {
  const { server } = await meridianApp(t);
  const lina = await tokenFor(server, 'lina');
  const reset = (token, userId) => as(request(server).post(`/api/members/${userId}/password-reset`), token);
  assert.equal((await reset(lina, '10').expect(403)).body.code, 'MEMBER_SELF');
  // noor also has a (switched off) membership at Harbor, zara a platform role: same neutral answer for both.
  assert.equal((await reset(lina, '13').expect(403)).body.code, 'MEMBER_NOT_ALLOWED');
  assert.equal((await reset(lina, '14').expect(403)).body.code, 'MEMBER_NOT_ALLOWED');
});
