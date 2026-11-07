require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TenantAdministratorsService } = require('../dist/modules/platform/tenant-administrators.service');
const { TenantsService } = require('../dist/modules/platform/tenants.service');

const actor = { id: '1', username: 'maya' };
const presenceFake = () => {
  const calls = [];
  return {
    calls,
    refresh: async (organizationId, userId) => { calls.push(['refresh', organizationId, userId]); },
    closeCompany: async (organizationId) => { calls.push(['closeCompany', organizationId]); },
  };
};

// The repositories decide what happened; the services tell presence afterwards. These tests give the services
// repositories that answer as the real ones do for each case (test:db checks the SQL itself).
function administrators(result) {
  const presence = presenceFake();
  const repository = { revoke: async () => result };
  return { presence, service: new TenantAdministratorsService(repository, { findById: async () => ({}) }, presence) };
}

test('removing a tenant administrator who is the last one suspends the tenant and closes its sockets; removing one of several refreshes that person', async () => {
  const last = administrators({ done: true, tenantSuspended: true });
  assert.deepEqual(await last.service.revoke('1', '8', { outcome: 'suspend_tenant', reason: 'Contract ended' }, actor), { tenantSuspended: true });
  assert.deepEqual(last.presence.calls, [['closeCompany', '1']]);

  const one = administrators({ done: true, tenantSuspended: false });
  await one.service.revoke('1', '9', { outcome: 'remove', reason: 'Left' }, actor);
  assert.deepEqual(one.presence.calls, [['refresh', '1', '9']]);

  // The company was already suspended, so only the membership went.
  const already = administrators({ done: true, tenantSuspended: false });
  await already.service.revoke('1', '9', { outcome: 'suspend_tenant', reason: 'Left' }, actor);
  assert.deepEqual(already.presence.calls, [['refresh', '1', '9']]);

  // Moving them to another role keeps the membership, so their status does not change.
  const moved = administrators({ done: true, tenantSuspended: false });
  await moved.service.revoke('1', '9', { outcome: 'change_role', roleCode: 'dispatcher', reason: 'Moved' }, actor);
  assert.deepEqual(moved.presence.calls, []);

  // A revoke that was refused changes nothing.
  const refused = administrators({ done: false, problem: 'last_administrator' });
  await assert.rejects(refused.service.revoke('1', '9', { outcome: 'remove', reason: 'x' }, actor));
  assert.deepEqual(refused.presence.calls, []);
});

test('suspending a company closes every socket of that company', async () => {
  const presence = presenceFake();
  const organization = { id: '1', name: 'Meridian', slug: 'meridian', contactEmail: 'a@b.test', isActive: false };
  let result = { changed: true, organization };
  const service = new TenantsService({ setActive: async () => result }, presence);
  await service.setActive('1', false, 'Contract ended', actor);
  assert.deepEqual(presence.calls, [['closeCompany', '1']]);
  // Reactivating opens nothing: people connect again themselves.
  await service.setActive('1', true, null, actor);
  assert.deepEqual(presence.calls, [['closeCompany', '1']]);
  // Nothing changed, nothing closed.
  result = { changed: false, problem: 'same_status' };
  await assert.rejects(service.setActive('1', false, 'again', actor));
  assert.deepEqual(presence.calls, [['closeCompany', '1']]);
});
