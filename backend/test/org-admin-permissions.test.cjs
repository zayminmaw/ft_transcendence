const { test } = require('node:test');
const assert = require('node:assert/strict');
const { OrgAdminAllPermissions1793923200000 } = require('../dist/database/migrations/1793923200000-OrgAdminAllPermissions');

const ORIGINAL_ORG_ADMIN_PERMISSIONS = [
  'admin.manage_users',
  'admin.manage_roles',
  'admin.audit_logs',
  'contacts.manage_own',
];

const EXPECTED_ADDED_PERMISSIONS = [
  'clients.view', 'clients.create', 'clients.edit', 'clients.delete', 'clients.view_financials',
  'parcels.view', 'parcels.create', 'parcels.dispatch', 'parcels.update_status', 'parcels.mark_delivered', 'parcels.override_fee',
  'staff.view', 'staff.manage', 'staff.view_payroll',
  'drivers.view', 'drivers.manage', 'drivers.view_compliance', 'drivers.view_earnings',
  'assets.view', 'assets.create', 'assets.assign', 'assets.log_maintenance',
  'billing.view', 'billing.reconcile_cod', 'billing.create_invoice', 'billing.adjust_balance', 'billing.export',
];

test('OrgAdminAllPermissions migration grants all 27 remaining tenant permissions idempotently and reverts only them', async () => {
  const migration = new OrgAdminAllPermissions1793923200000();
  assert.equal(migration.transaction, true);

  const upCalls = [];
  await migration.up({ query: async (sql, params) => { upCalls.push({ sql, params }); } });
  assert.deepEqual(upCalls.map((call) => call.params[0]), EXPECTED_ADDED_PERMISSIONS);
  for (const { sql, params } of upCalls) {
    assert.match(sql, /INSERT INTO role_permissions/);
    assert.match(sql, /r\.code = 'org_admin'/);
    assert.match(sql, /'all'/);
    assert.match(sql, /NOT EXISTS/);
    assert.equal(ORIGINAL_ORG_ADMIN_PERMISSIONS.includes(params[0]), false);
  }

  const downCalls = [];
  await migration.down({ query: async (sql, params) => { downCalls.push({ sql, params }); } });
  assert.deepEqual(downCalls.map((call) => call.params[0]), EXPECTED_ADDED_PERMISSIONS);
  for (const { sql, params } of downCalls) {
    assert.match(sql, /DELETE rp FROM role_permissions rp/);
    assert.match(sql, /r\.code = 'org_admin'/);
    assert.equal(ORIGINAL_ORG_ADMIN_PERMISSIONS.includes(params[0]), false);
  }
});

