const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { AuditLog } = require('../../dist/modules/audit/entities/audit-log.entity');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');
const { OrganizationMember } = require('../../dist/modules/organizations/entities/organization-member.entity');
const { Role } = require('../../dist/modules/rbac/entities/role.entity');
const { TenantAdministratorsRepository } = require('../../dist/modules/platform/tenant-administrators.repository');
const { TenantsRepository } = require('../../dist/modules/platform/tenants.repository');
const { User } = require('../../dist/modules/users/entities/user.entity');

let database;
let tenants;
let administrators;
let actor;
before(async () => {
  database = await createTestDatabase();
  tenants = new TenantsRepository(database, database.getRepository(Organization));
  administrators = new TenantAdministratorsRepository(database);
  const platformUser = await database.getRepository(User).save({ username: 'platform.actor', email: 'platform.actor@db.test', passwordHash: 'placeholder-hash' });
  actor = { userId: platformUser.id, ip: '127.0.0.1', userAgent: 'node-test' };
});
after(() => database?.destroy());

const account = (username) => ({ username, email: `${username}@db.test`, passwordHash: 'placeholder-hash' });
const newTenant = (slug, admin) => ({
  organization: { name: `${slug} company`, slug, contactEmail: `ops@${slug}.db.test`, contactPhone: null, address: null },
  administrator: account(admin),
});

// A company created through the repository, with its first administrator.
async function createTenant(slug, admin) {
  const result = await tenants.create(newTenant(slug, admin), actor);
  assert.equal(result.created, true);
  return { id: result.organization.id, adminId: result.administrator.id };
}

async function addMember(organizationId, username, roleCode, { isActive = true, accountActive = true } = {}) {
  const user = await database.getRepository(User).save({ ...account(username), isActive: accountActive });
  const role = await database.getRepository(Role).findOneByOrFail({ code: roleCode });
  await database.getRepository(OrganizationMember).insert({ organizationId, userId: user.id, roleId: role.id, isActive });
  return user.id;
}

const membership = async (organizationId, userId) => {
  const row = await database.getRepository(OrganizationMember).findOneByOrFail({ organizationId, userId });
  const role = await database.getRepository(Role).findOneByOrFail({ id: row.roleId });
  return { role: role.code, isActive: row.isActive };
};
const isActive = async (id) => (await database.getRepository(Organization).findOneByOrFail({ id })).isActive;
const audits = (organizationId) => database.getRepository(AuditLog).find({ where: { module: 'platform', organizationId }, order: { id: 'ASC' } });
const adminIds = async (id) => (await tenants.findAdministrators(id)).map((admin) => admin.id);

test('creating a tenant adds the company, its administrator and their membership, or nothing at all', async () => {
  const { id, adminId } = await createTenant('create-db', 'create.admin');
  assert.deepEqual(await membership(id, adminId), { role: 'org_admin', isActive: true });
  assert.deepEqual((await audits(id)).map((row) => row.action), ['create']);
  assert.equal(JSON.stringify((await audits(id))[0].newValues).includes('placeholder-hash'), false);

  const organizations = await database.getRepository(Organization).count();
  const users = await database.getRepository(User).count();
  assert.deepEqual(await tenants.create(newTenant('create-db', 'other.admin'), actor), { created: false, conflict: 'slug' });
  assert.deepEqual(await tenants.create(newTenant('create-two-db', 'create.admin'), actor), { created: false, conflict: 'username' });
  assert.deepEqual(
    await tenants.create({ ...newTenant('create-two-db', 'other.admin'), administrator: { ...account('other.admin'), email: 'create.admin@db.test' } }, actor),
    { created: false, conflict: 'email' },
  );
  assert.equal(await database.getRepository(Organization).count(), organizations);
  assert.equal(await database.getRepository(User).count(), users);
});

test('the member list offers that company\'s members and removed members, never its current administrators', async () => {
  const { id } = await createTenant('candidates-db', 'candidates.admin');
  const other = await createTenant('candidates-other-db', 'candidates.other');
  await addMember(id, 'cand.dispatch', 'dispatcher');
  await addMember(id, 'cand.finance', 'finance');
  await addMember(id, 'cand.left', 'driver', { isActive: false });
  await addMember(id, 'cand.disabled', 'driver', { accountActive: false });
  await addMember(other.id, 'cand.elsewhere', 'dispatcher');
  const dispatcher = await database.getRepository(User).findOneByOrFail({ username: 'cand.dispatch' });
  const dispatcherRole = await database.getRepository(Role).findOneByOrFail({ code: 'dispatcher' });
  assert.deepEqual((await administrators.findCandidates(id))[0], {
    id: dispatcher.id, username: 'cand.dispatch', email: 'cand.dispatch@db.test', role: { code: 'dispatcher', name: dispatcherRole.name },
    removed: false,
  });
  await addMember(id, 'cand.removed.admin', 'org_admin', { isActive: false });
  assert.deepEqual(
    (await administrators.findCandidates(id)).map(({ username, removed }) => [username, removed]),
    [['cand.dispatch', false], ['cand.finance', false], ['cand.left', true], ['cand.removed.admin', true]],
  );
  assert.deepEqual((await administrators.findCandidates(id, 'FIN')).map((member) => member.username), ['cand.finance']);
  assert.deepEqual(await administrators.findCandidates(id, '%'), []);
});

test('the roles offered for a revoked administrator come from the database, never org_admin or platform_admin', async () => {
  const { id, adminId } = await createTenant('roles-db', 'roles.admin');
  await addMember(id, 'roles.second', 'org_admin');
  await database.getRepository(Role).save({ code: 'db_test_supervisor', name: 'Supervisor', description: null });
  assert.deepEqual(
    (await administrators.findMemberRoles()).map((role) => role.code).sort(),
    ['db_test_supervisor', 'dispatcher', 'driver', 'finance', 'fleet_lead', 'hr_manager', 'hub_sorter'],
  );

  for (const roleCode of ['org_admin', 'platform_admin', 'no_such_role']) {
    assert.deepEqual(
      await administrators.revoke(id, adminId, { outcome: 'change_role', roleCode, reason: 'Moved' }, actor),
      { done: false, problem: 'role_not_available' },
    );
  }
  assert.deepEqual(await membership(id, adminId), { role: 'org_admin', isActive: true });
  assert.deepEqual(
    await administrators.revoke(id, adminId, { outcome: 'change_role', roleCode: 'db_test_supervisor', reason: 'Moved' }, actor),
    { done: true, tenantSuspended: false },
  );
  assert.deepEqual(await membership(id, adminId), { role: 'db_test_supervisor', isActive: true });
});

test('an administrator can be a new account or an existing member, and both are audited', async () => {
  const { id, adminId } = await createTenant('assign-db', 'assign.admin');
  const fresh = await administrators.assign(id, { mode: 'new', account: account('assign.new') }, actor);
  assert.equal(fresh.done, true);
  assert.deepEqual(await membership(id, fresh.administrator.id), { role: 'org_admin', isActive: true });
  assert.deepEqual(await administrators.assign(id, { mode: 'new', account: account('assign.new') }, actor), { done: false, problem: 'username' });
  assert.deepEqual(
    await administrators.assign(id, { mode: 'new', account: { ...account('assign.other'), email: 'assign.new@db.test' } }, actor),
    { done: false, problem: 'email' },
  );

  const dispatcher = await addMember(id, 'assign.dispatch', 'dispatcher');
  const existing = await administrators.assign(id, { mode: 'existing', userId: dispatcher }, actor);
  assert.deepEqual(existing, { done: true, administrator: { id: dispatcher, username: 'assign.dispatch', email: 'assign.dispatch@db.test' } });
  assert.deepEqual(await membership(id, dispatcher), { role: 'org_admin', isActive: true });
  assert.deepEqual(await administrators.assign(id, { mode: 'existing', userId: adminId }, actor), { done: false, problem: 'already_administrator' });

  // A removed administrator keeps their account, so they come back through their old membership.
  assert.deepEqual(await administrators.revoke(id, dispatcher, { outcome: 'remove', reason: 'Left' }, actor), { done: true, tenantSuspended: false });
  assert.deepEqual(await membership(id, dispatcher), { role: 'org_admin', isActive: false });
  assert.equal((await administrators.assign(id, { mode: 'existing', userId: dispatcher }, actor)).done, true);
  assert.deepEqual(await membership(id, dispatcher), { role: 'org_admin', isActive: true });
  const [reinstated] = (await audits(id)).slice(-1);
  assert.equal(reinstated.oldValues.membershipActive, false);
  assert.equal(reinstated.newValues.membershipActive, true);

  const left = await addMember(id, 'assign.left', 'driver', { isActive: false });
  assert.equal((await administrators.assign(id, { mode: 'existing', userId: left }, actor)).done, true);
  assert.deepEqual(await membership(id, left), { role: 'org_admin', isActive: true });

  const disabled = await addMember(id, 'assign.disabled', 'driver', { accountActive: false });
  const elsewhere = await addMember((await createTenant('assign-other-db', 'assign.other.admin')).id, 'assign.elsewhere', 'driver');
  for (const userId of [disabled, elsewhere, '999999']) {
    assert.deepEqual(await administrators.assign(id, { mode: 'existing', userId }, actor), { done: false, problem: 'member_not_found' });
  }
  assert.deepEqual(await administrators.assign('999999', { mode: 'existing', userId: dispatcher }, actor), { done: false, problem: 'tenant_not_found' });

  const assigned = (await audits(id)).filter((row) => row.action === 'assign');
  assert.equal(assigned.length, 4);
  assert.deepEqual(
    assigned[1].oldValues, { administrator: { id: dispatcher, username: 'assign.dispatch' }, role: 'dispatcher', membershipActive: true },
  );
  assert.equal(JSON.stringify(assigned).includes('placeholder-hash'), false);
});

test('revoking one of several administrators changes their role or removes them, as chosen', async () => {
  const { id, adminId } = await createTenant('revoke-db', 'revoke.admin');
  const second = await addMember(id, 'revoke.second', 'org_admin');
  const third = await addMember(id, 'revoke.third', 'org_admin');

  assert.deepEqual(
    await administrators.revoke(id, second, { outcome: 'suspend_tenant', reason: 'Not the last' }, actor),
    { done: false, problem: 'not_last_administrator' },
  );
  assert.deepEqual(
    await administrators.revoke(id, second, { outcome: 'change_role', roleCode: 'dispatcher', reason: 'Moved to dispatch' }, actor),
    { done: true, tenantSuspended: false },
  );
  assert.deepEqual(await membership(id, second), { role: 'dispatcher', isActive: true });
  assert.deepEqual(await administrators.revoke(id, third, { outcome: 'remove', reason: 'Left the company' }, actor), { done: true, tenantSuspended: false });
  assert.deepEqual(await membership(id, third), { role: 'org_admin', isActive: false });
  assert.deepEqual(await adminIds(id), [adminId]);
  assert.equal(await isActive(id), true);

  assert.deepEqual(await administrators.revoke(id, second, { outcome: 'remove', reason: 'Again' }, actor), { done: false, problem: 'administrator_not_found' });
  assert.deepEqual(await administrators.revoke('999999', adminId, { outcome: 'remove', reason: 'No company' }, actor), { done: false, problem: 'tenant_not_found' });
  const revoked = (await audits(id)).filter((row) => row.action === 'revoke');
  assert.deepEqual(revoked.map((row) => row.newValues.reason), ['Moved to dispatch', 'Left the company']);
});

test('a revoked administrator is never moved to an administrator role, whatever its case', async () => {
  const { id } = await createTenant('role-case-db', 'role.case.admin');
  const second = await addMember(id, 'role.case.second', 'org_admin');
  for (const roleCode of ['org_admin', 'ORG_ADMIN', 'Platform_Admin']) {
    assert.deepEqual(
      await administrators.revoke(id, second, { outcome: 'change_role', roleCode, reason: 'Try an admin role' }, actor),
      { done: false, problem: 'role_not_available' },
    );
  }
  assert.deepEqual(await membership(id, second), { role: 'org_admin', isActive: true });
  assert.deepEqual((await audits(id)).filter((row) => row.action === 'tenant.administrator.revoke'), []);

  assert.deepEqual(
    await administrators.revoke(id, second, { outcome: 'change_role', roleCode: 'DISPATCHER', reason: 'Moved to dispatch' }, actor),
    { done: true, tenantSuspended: false },
  );
  assert.deepEqual(await membership(id, second), { role: 'dispatcher', isActive: true });
});

test('revoking the last administrator must suspend the tenant, and an administrator whose account is off does not count', async () => {
  const { id, adminId } = await createTenant('last-db', 'last.admin');
  const disabled = await addMember(id, 'last.disabled', 'org_admin', { accountActive: false });
  for (const outcome of ['remove', 'change_role']) {
    assert.deepEqual(
      await administrators.revoke(id, adminId, { outcome, roleCode: 'driver', reason: 'Leaving' }, actor),
      { done: false, problem: 'last_administrator' },
    );
  }
  assert.deepEqual(await membership(id, adminId), { role: 'org_admin', isActive: true });

  assert.deepEqual(await administrators.revoke(id, adminId, { outcome: 'suspend_tenant', reason: 'Owner left' }, actor), { done: true, tenantSuspended: true });
  assert.deepEqual(await membership(id, adminId), { role: 'org_admin', isActive: false });
  assert.equal(await isActive(id), false);
  const [revoke, suspend] = (await audits(id)).slice(-2);
  assert.equal(revoke.action, 'revoke');
  assert.equal(suspend.action, 'status_change');
  assert.equal(suspend.newValues.reason, 'Owner left');
  assert.equal(suspend.newValues.cause, 'last_administrator_revoked');
  // No rename in these changes, yet both are labelled with the company's name.
  const { name } = await database.getRepository(Organization).findOneByOrFail({ id });
  assert.deepEqual([revoke.resourceLabel, suspend.resourceLabel], [name, name]);

  // The disabled administrator is now the last one too; the company is already suspended, so nothing else changes.
  const before = (await audits(id)).length;
  assert.deepEqual(await administrators.revoke(id, disabled, { outcome: 'suspend_tenant', reason: 'Cleanup' }, actor), { done: true, tenantSuspended: false });
  assert.deepEqual((await audits(id)).slice(before).map((row) => row.action), ['revoke']);
});

test('a tenant without an administrator can only be reactivated once one is assigned', async () => {
  const { id, adminId } = await createTenant('reactivate-db', 'reactivate.admin');
  await administrators.revoke(id, adminId, { outcome: 'suspend_tenant', reason: 'Owner left' }, actor);
  assert.deepEqual(await tenants.setActive(id, true, null, actor), { changed: false, problem: 'no_administrator' });
  assert.deepEqual(await tenants.setActive(id, false, 'Again', actor), { changed: false, problem: 'same_status' });
  assert.deepEqual(await tenants.setActive('999999', true, null, actor), { changed: false, problem: 'not_found' });

  assert.equal((await administrators.assign(id, { mode: 'new', account: account('reactivate.new') }, actor)).done, true);
  const result = await tenants.setActive(id, true, 'New owner', actor);
  assert.equal(result.changed, true);
  assert.equal(result.organization.isActive, true);
  assert.equal(await isActive(id), true);
});

test('two administrators revoked at once never leave the tenant without one', async () => {
  const { id, adminId } = await createTenant('race-db', 'race.admin');
  const second = await addMember(id, 'race.second', 'org_admin');
  const results = await Promise.all([
    administrators.revoke(id, adminId, { outcome: 'remove', reason: 'Race one' }, actor),
    administrators.revoke(id, second, { outcome: 'remove', reason: 'Race two' }, actor),
  ]);
  assert.deepEqual(results.map((result) => result.done ? 'done' : result.problem).sort(), ['done', 'last_administrator']);
  assert.equal((await adminIds(id)).length, 1);
  assert.equal(await isActive(id), true);
});
