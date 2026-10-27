const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { ActivityRepository } = require('../../dist/modules/platform/activity.repository');
const { AuditLog } = require('../../dist/modules/audit/entities/audit-log.entity');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');
const { TenantAdministratorsRepository } = require('../../dist/modules/platform/tenant-administrators.repository');
const { TenantsRepository } = require('../../dist/modules/platform/tenants.repository');
const { User } = require('../../dist/modules/users/entities/user.entity');

let database;
let activity;
let north;
let south;
before(async () => {
  database = await createTestDatabase();
  activity = new ActivityRepository(database);
  const tenants = new TenantsRepository(database, database.getRepository(Organization));
  const administrators = new TenantAdministratorsRepository(database);
  const save = (username) => database.getRepository(User).save({ username, email: `${username}@db.test`, passwordHash: 'placeholder-hash' });
  const maya = { userId: (await save('maya.platform')).id, ip: '127.0.0.1', userAgent: 'node-test' };
  const sami = { userId: (await save('sami.platform')).id, ip: '127.0.0.1', userAgent: 'node-test' };
  const create = async (slug, admin, actor) => {
    const result = await tenants.create({
      organization: { name: `${slug} company`, slug, contactEmail: `ops@${slug}.db.test`, contactPhone: null, address: null },
      administrator: { username: admin, email: `${admin}@db.test`, passwordHash: 'placeholder-hash' },
    }, actor);
    return { id: result.organization.id, adminId: result.administrator.id };
  };

  // north: create, update, assign a second administrator, revoke the first, suspend. south: create only.
  north = await create('north', 'north.admin', maya);
  await tenants.update(north.id, { contactEmail: 'desk@north.db.test', address: 'Harbour 1' }, sami);
  const second = await administrators.assign(north.id, { mode: 'new', account: { username: 'north.second', email: 'north.second@db.test', passwordHash: 'placeholder-hash' } }, sami);
  await administrators.revoke(north.id, north.adminId, { outcome: 'change_role', roleCode: 'dispatcher', reason: 'Moved to dispatch' }, maya);
  await administrators.revoke(north.id, second.administrator.id, { outcome: 'suspend_tenant', reason: 'Contract ended' }, maya);
  south = await create('south', 'south.admin', sami);

  // Not platform activity, and platform activity too old for the counts.
  await database.getRepository(AuditLog).insert({ module: 'auth', action: 'login.success', organizationId: north.id, userId: maya.userId });
  await database.getRepository(AuditLog).insert({ module: 'platform', action: 'tenant.update', organizationId: south.id, userId: sami.userId, newValues: { name: 'old' } });
  await database.query('UPDATE audit_logs SET created_at = NOW() - INTERVAL 10 DAY ORDER BY id DESC LIMIT 1');
});
after(() => database?.destroy());

const query = (overrides = {}) => ({ action: 'all', sort: 'createdAt', direction: 'desc', page: 1, pageSize: 10, ...overrides });
const actions = (result) => result.items.map((event) => event.action);

test('the activity lists platform changes newest first, with the tenant, the actor and display details only', async () => {
  const result = await activity.list(query({ tenantId: north.id }));
  assert.equal(result.total, 6);
  assert.deepEqual(actions(result), [
    'tenant.suspend', 'tenant.administrator.revoke', 'tenant.administrator.revoke', 'tenant.administrator.assign', 'tenant.update', 'tenant.create',
  ]);
  const byAction = (action, index = 0) => result.items.filter((event) => event.action === action)[index];
  assert.deepEqual(byAction('tenant.create').tenant, { id: north.id, name: 'north company' });
  assert.equal(byAction('tenant.create').actor, 'maya.platform');
  assert.deepEqual(byAction('tenant.create').details, { administrator: 'north.admin' });
  assert.deepEqual(byAction('tenant.update').details, { fields: ['contactEmail', 'address'] });
  assert.deepEqual(byAction('tenant.administrator.assign').details, { administrator: 'north.second', account: 'new', previousRole: undefined });
  assert.deepEqual(byAction('tenant.administrator.revoke', 1).details, {
    administrator: 'north.admin', reason: 'Moved to dispatch', revoke: 'change_role', role: 'dispatcher',
  });
  assert.deepEqual(byAction('tenant.administrator.revoke', 0).details, { administrator: 'north.second', reason: 'Contract ended', revoke: 'remove' });
  assert.deepEqual(byAction('tenant.suspend').details, { reason: 'Contract ended', administrator: 'north.second', cause: 'last_administrator_revoked' });
  assert.equal(JSON.stringify(result.items).includes('db.test'), false, 'emails and contact details stay on the server');
});

test('the activity filters by action group, searches tenant and actor, sorts and pages', async () => {
  assert.deepEqual(actions(await activity.list(query({ action: 'status' }))), ['tenant.suspend']);
  assert.deepEqual(actions(await activity.list(query({ action: 'created', direction: 'asc' }))), ['tenant.create', 'tenant.create']);
  assert.equal((await activity.list(query({ action: 'administrators' }))).total, 3);

  const bySouth = await activity.list(query({ search: 'south' }));
  assert.deepEqual(bySouth.items.map((event) => event.tenant.name), ['south company', 'south company']);
  assert.equal((await activity.list(query({ search: 'sami.plat' }))).total, 4);
  assert.equal((await activity.list(query({ search: '%' }))).total, 0, 'wildcards are matched literally');

  const byTenant = await activity.list(query({ sort: 'tenant', direction: 'desc' }));
  assert.equal(byTenant.total, 8);
  assert.deepEqual(byTenant.items.slice(0, 2).map((event) => event.tenant.name), ['south company', 'south company']);
  const second = await activity.list(query({ page: 2, pageSize: 3 }));
  assert.equal(second.total, 8);
  assert.equal(second.items.length, 3);
});

test('the counts cover the last seven days of platform changes, for one tenant when asked', async () => {
  assert.deepEqual(await activity.counts(), { events: 7, created: 2, details: 1, status: 1, administrators: 3 });
  assert.deepEqual(await activity.counts(south.id), { events: 1, created: 1, details: 0, status: 0, administrators: 0 });
});
