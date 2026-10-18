const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');

let database;
before(async () => { database = await createTestDatabase(); });
after(() => database?.destroy());

const count = async (sql, params = []) => Number((await database.query(sql, params))[0].total);

test('the migrations add the sessions table and the documented roles and permissions', async () => {
  assert.equal(await count('SELECT COUNT(*) AS total FROM permissions'), 30);
  assert.equal(await count('SELECT COUNT(*) AS total FROM roles'), 8);
  assert.equal(await count('SELECT COUNT(*) AS total FROM role_permissions'), 47);
  assert.equal(await count(`SELECT COUNT(*) AS total FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
    WHERE r.code = 'driver' AND rp.scope = 'assigned_only'`), 4);
  assert.equal(await count(`SELECT COUNT(*) AS total FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
    WHERE r.code = 'platform_admin'`), 0);
  assert.equal(await count(`SELECT COUNT(*) AS total FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'user_sessions'`), 1);
});

const { User } = require('../../dist/modules/users/entities/user.entity');
const { UsersRepository } = require('../../dist/modules/users/users.repository');

// A user with a placeholder hash; login itself is covered by the HTTP tests.
async function createUser(username, email = `${username}@db.test`) {
  return (await database.getRepository(User).save({ username, email, passwordHash: 'placeholder-hash' })).id;
}

test('users are found by email or username in any case, and inactive users are reported', async () => {
  const users = new UsersRepository(database.getRepository(User));
  const id = await createUser('dana.db', 'Dana.DB@db.test');
  assert.equal((await users.findByLogin('DANA.DB')).id, id);
  assert.equal((await users.findByLogin('dana.db@DB.TEST')).username, 'dana.db');
  assert.equal(await users.findByLogin('dana.db@'), undefined);
  assert.equal(await users.isActive(id), true);
  await database.getRepository(User).update({ id }, { isActive: false });
  assert.equal(await users.isActive(id), false);
  assert.equal((await users.findById(id)).isActive, false);
  assert.equal(await users.isActive('999999'), false);
});

const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');
const { OrganizationMember } = require('../../dist/modules/organizations/entities/organization-member.entity');
const { OrganizationMembersRepository } = require('../../dist/modules/organizations/organization-members.repository');
const { Role } = require('../../dist/modules/rbac/entities/role.entity');
const { UserRole } = require('../../dist/modules/rbac/entities/user-role.entity');
const { PlatformRolesRepository } = require('../../dist/modules/rbac/platform-roles.repository');

const createMembers = () => new OrganizationMembersRepository(database, database.getRepository(OrganizationMember));
const createPlatformRoles = () => new PlatformRolesRepository(database.getRepository(UserRole));

async function createCompany(slug, name) {
  return (await database.getRepository(Organization).save({ name, slug, contactEmail: `ops@${slug}.db.test` })).id;
}

async function addMember(organizationId, userId, roleCode, isActive = true) {
  const role = await database.getRepository(Role).findOneByOrFail({ code: roleCode });
  await database.getRepository(OrganizationMember).insert({ organizationId, userId, roleId: role.id, isActive });
}

test('the picker lists active memberships in active companies, sorted by name', async () => {
  const members = createMembers();
  const alpha = await createCompany('alpha-db', 'Alpha Freight');
  const beta = await createCompany('beta-db', 'Beta Couriers');
  const both = await createUser('two.companies.db');
  const switchedOff = await createUser('switched.off.db');
  await addMember(beta, both, 'dispatcher');
  await addMember(alpha, both, 'finance');
  await addMember(alpha, switchedOff, 'hub_sorter', false);
  assert.deepEqual(await members.findActiveWorkspaces(both), [
    { id: alpha, slug: 'alpha-db', name: 'Alpha Freight' },
    { id: beta, slug: 'beta-db', name: 'Beta Couriers' },
  ]);
  assert.deepEqual(await members.findActiveWorkspaces(switchedOff), []);
  await database.getRepository(Organization).update({ id: beta }, { isActive: false });
  assert.deepEqual((await members.findActiveWorkspaces(both)).map((workspace) => workspace.slug), ['alpha-db']);
});

test('platform access comes from user_roles only, never from a membership', async () => {
  const platformRoles = createPlatformRoles();
  const admin = await createUser('platform.db');
  const member = await createUser('member.db');
  await addMember(await createCompany('gamma-db', 'Gamma Logistics'), member, 'platform_admin');
  await platformRoles.grantPlatformAdmin(admin);
  assert.equal(await platformRoles.hasPlatformAccess(admin), true);
  assert.equal(await platformRoles.hasPlatformAccess(member), false);
});
