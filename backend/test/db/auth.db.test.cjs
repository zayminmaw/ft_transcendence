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
  const sessionColumns = async (name) => count(`SELECT COUNT(*) AS total FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'user_sessions' AND column_name = ?`, [name]);
  assert.equal(await sessionColumns('family_id'), 1);
  // previous_token_hash came back in 1792454400000, with rotated_at, for the 10-second reuse interval.
  assert.equal(await sessionColumns('previous_token_hash'), 1);
  assert.equal(await sessionColumns('rotated_at'), 1);
  assert.equal(await count(`SELECT COUNT(*) AS total FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'must_change_password'`), 1);
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

const { JwtService } = require('@nestjs/jwt');
const { AuthAuditRepository } = require('../../dist/modules/auth/auth-audit.repository');
const { AuditLog } = require('../../dist/modules/auth/entities/audit-log.entity');
const { UserSession } = require('../../dist/modules/auth/entities/user-session.entity');
const { SessionsRepository } = require('../../dist/modules/auth/sessions.repository');
const { SessionsService } = require('../../dist/modules/auth/sessions.service');

const META = { ip: '127.0.0.1', userAgent: 'node-test' };
const DAY = 86_400_000;
const createSessions = () => new SessionsService(
  new SessionsRepository(database.getRepository(UserSession)), new UsersRepository(database.getRepository(User)),
  new JwtService({ secret: 'test-secret-with-at-least-32-characters', signOptions: { expiresIn: '15m' } }),
  new AuthAuditRepository(database.getRepository(AuditLog)),
);
// A refresh token is "<familyId>.<secret>"; the family id names the session row.
const sessionRow = (refreshToken) => database.getRepository(UserSession).findOneByOrFail({ familyId: refreshToken.split('.')[0] });
const auditCount = (action, userId) => database.getRepository(AuditLog).countBy({ module: 'auth', action, userId });

test('session times survive the round trip to the database', async () => {
  const sessions = createSessions();
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  const issued = await sessions.start(await createUser('session.times'), META, now);
  const row = await sessionRow(issued.refreshToken);
  assert.equal(row.idleExpiresAt.toISOString(), new Date(now.getTime() + 7 * DAY).toISOString());
  assert.equal(row.absoluteExpiresAt.toISOString(), new Date(now.getTime() + 30 * DAY).toISOString());
  assert.equal(await sessions.refresh(issued.refreshToken, META, new Date(now.getTime() + 8 * DAY)), undefined);
});

test('a refresh token works once; using it again more than 10 seconds later ends the session and is audited', async () => {
  const sessions = createSessions();
  const userId = await createUser('session.reuse');
  const issued = await sessions.start(userId, META);
  const renewed = await sessions.refresh(issued.refreshToken, META);
  assert.ok(renewed);
  assert.equal(await sessions.refresh(issued.refreshToken, META, new Date(Date.now() + 11_000)), undefined);
  assert.equal(await sessions.refresh(renewed.refreshToken, META), undefined);
  assert.equal((await sessionRow(renewed.refreshToken)).revokedReason, 'reuse');
  assert.equal(await auditCount('session_reuse', userId), 1);
});

test('a token copied and refreshed twice is still caught when the old token comes back', async () => {
  const sessions = createSessions();
  const userId = await createUser('session.thief');
  const stolen = await sessions.start(userId, META);
  const second = await sessions.refresh(stolen.refreshToken, META);
  const third = await sessions.refresh(second.refreshToken, META);
  assert.equal(await sessions.refresh(stolen.refreshToken, META), undefined);
  assert.equal((await sessionRow(third.refreshToken)).revokedReason, 'reuse');
  assert.equal(await sessions.refresh(third.refreshToken, META), undefined);
  assert.equal(await auditCount('session_reuse', userId), 1);
});

test('logging out with a token replaced more than 10 seconds ago is recorded as a copied token', async () => {
  const sessions = createSessions();
  const userId = await createUser('session.stale.logout');
  const stolen = await sessions.start(userId, META);
  const current = await sessions.refresh(stolen.refreshToken, META);
  await sessions.end(stolen.refreshToken, META, new Date(Date.now() + 11_000));
  assert.equal((await sessionRow(current.refreshToken)).revokedReason, 'reuse');
  assert.equal(await auditCount('session_reuse', userId), 1);
  assert.equal(await auditCount('logout', userId), 0);
});

test('two refreshes with the same token at once both work: the second counts as a missed answer', async () => {
  const sessions = createSessions();
  const userId = await createUser('session.race');
  const issued = await sessions.start(userId, META);
  const results = await Promise.all([sessions.refresh(issued.refreshToken, META), sessions.refresh(issued.refreshToken, META)]);
  assert.equal(results.filter(Boolean).length, 2);
  assert.equal((await sessionRow(issued.refreshToken)).revokedAt, null);
  assert.equal(await auditCount('session_reuse', userId), 0);
});

test('a replaced token works for 10 seconds after it was replaced, and repeating it does not stretch that', async () => {
  const sessions = createSessions();
  const userId = await createUser('session.missed');
  const start = new Date(Math.floor(Date.now() / 1000) * 1000);
  const kept = await sessions.start(userId, META, start);
  assert.ok(await sessions.refresh(kept.refreshToken, META, start));
  assert.ok(await sessions.refresh(kept.refreshToken, META, new Date(start.getTime() + 6_000)));
  assert.equal(await sessions.refresh(kept.refreshToken, META, new Date(start.getTime() + 11_000)), undefined);
  assert.equal(await auditCount('session_reuse', userId), 1);
});

test('logout ends the session and is audited', async () => {
  const sessions = createSessions();
  const userId = await createUser('session.logout');
  const issued = await sessions.start(userId, META);
  await sessions.end(issued.refreshToken, META);
  assert.equal(await sessions.refresh(issued.refreshToken, META), undefined);
  assert.equal(await auditCount('logout', userId), 1);
});

const { AccountError, createAccount } = require('../../dist/modules/users/accounts');

test('createAccount refuses names that differ only in case, and of two racing creates only one wins', async () => {
  const input = { username: 'case.db', email: 'case.db@db.test', password: 'Correct-horse-1', mustChangePassword: true };
  const id = await database.transaction((manager) => createAccount(manager, input));
  assert.equal((await database.getRepository(User).findOneByOrFail({ id })).mustChangePassword, true);
  await assert.rejects(
    database.transaction((manager) => createAccount(manager, { ...input, username: 'CASE.DB', email: 'other.case@db.test' })),
    AccountError,
  );
  const racing = { username: 'race.db', email: 'race.db@db.test', password: 'Correct-horse-1', mustChangePassword: true };
  const results = await Promise.allSettled([
    database.transaction((manager) => createAccount(manager, racing)),
    database.transaction((manager) => createAccount(manager, { ...racing, username: 'race.two.db' })),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(results.find((result) => result.status === 'rejected').reason.problem, 'taken');
  assert.equal(await database.getRepository(User).countBy({ email: 'race.db@db.test' }), 1);
});

const { createPlatformAdmin, PlatformAdminError } = require('../../dist/cli/platform-admin');

test('the first-admin command creates a platform admin and never reuses an account', async () => {
  const id = await createPlatformAdmin(database, { username: 'first.admin', email: 'first.admin@db.test', password: 'First-admin-1' });
  assert.equal(await createPlatformRoles().hasPlatformAccess(id), true);
  const refused = [
    { username: 'FIRST.ADMIN', email: 'other.admin@db.test', password: 'First-admin-1' },
    { username: 'new.admin', email: 'dana.db@db.test', password: 'First-admin-1' },
    { username: 'weak.admin', email: 'weak.admin@db.test', password: 'weakpassword' },
    { username: 'bad name', email: 'bad.name@db.test', password: 'First-admin-1' },
  ];
  for (const input of refused) await assert.rejects(createPlatformAdmin(database, input), PlatformAdminError);
  assert.equal(await database.getRepository(User).countBy(refused.map(({ username }) => ({ username }))), 1);
});

const { In, Like } = require('typeorm');
const { DEMO_ACCOUNTS, DEMO_PASSWORD, seedDemo } = require('../../dist/database/seeders/demo.seed');
const { verifyPassword } = require('../../dist/modules/users/password');

test('the demo seed adds everything once and skips it the second time', async () => {
  assert.deepEqual(await seedDemo(database), { companiesCreated: 2, accountsCreated: 12, accountsSkipped: [] });
  const again = await seedDemo(database);
  assert.deepEqual([again.companiesCreated, again.accountsCreated], [0, 0]);
  assert.deepEqual(again.accountsSkipped, DEMO_ACCOUNTS.map((account) => account.username));
  const demoIds = (await database.getRepository(User).findBy({ email: Like('%.example.test') })).map((user) => user.id);
  assert.equal(demoIds.length, 12);
  assert.equal(await database.getRepository(OrganizationMember).countBy({ userId: In(demoIds) }), 12);
  assert.equal(await database.getRepository(UserRole).countBy({ userId: In(demoIds) }), 2);
});

test('the demo accounts cover the picker cases and share the demo password', async () => {
  const users = new UsersRepository(database.getRepository(User));
  const members = createMembers();
  const platformRoles = createPlatformRoles();
  const id = async (username) => (await users.findByLogin(username)).id;
  const slugs = async (username) => (await members.findActiveWorkspaces(await id(username))).map((workspace) => workspace.slug);
  assert.deepEqual(await slugs('noor'), ['harbor-express', 'meridian-courier']);
  assert.deepEqual(await slugs('ex.member'), []);
  assert.deepEqual(await slugs('platform.ops'), []);
  assert.equal(await platformRoles.hasPlatformAccess(await id('platform.ops')), true);
  assert.equal(await platformRoles.hasPlatformAccess(await id('zara.platform')), true);
  assert.equal(await platformRoles.hasPlatformAccess(await id('lina')), false);
  assert.equal(await verifyPassword((await users.findByLogin('lina')).passwordHash, DEMO_PASSWORD), true);
});
