const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ADD_RULES, canAdd } = require('../dist/modules/contacts/contact-rules');

const TENANT_ROLES = ['org_admin', 'dispatcher', 'hub_sorter', 'finance', 'hr_manager', 'fleet_lead', 'driver'];

// The role matrix from the docs: who may add whom.
const TABLE = {
  org_admin: TENANT_ROLES,
  dispatcher: ['driver', 'dispatcher'],
  driver: ['dispatcher'],
  hr_manager: ['hr_manager', 'driver', 'dispatcher'],
  finance: ['finance', 'dispatcher', 'hr_manager'],
  hub_sorter: ['hub_sorter', 'dispatcher', 'driver'],
  fleet_lead: ['fleet_lead', 'dispatcher', 'driver'],
};

test('each role may add exactly the roles in the table', () => {
  for (const acting of TENANT_ROLES) {
    for (const target of TENANT_ROLES) {
      assert.equal(canAdd(acting, target), TABLE[acting].includes(target), `${acting} adding ${target}`);
    }
  }
  assert.deepEqual(Object.keys(ADD_RULES).sort(), [...TENANT_ROLES].sort());
});

test('platform_admin and unknown roles add and are added by nobody', () => {
  assert.equal(canAdd('platform_admin', 'driver'), false);
  assert.equal(canAdd('driver', 'platform_admin'), false);
  assert.equal(canAdd('intern', 'driver'), false);
  assert.equal(canAdd('driver', 'intern'), false);
  assert.equal(canAdd('toString', 'driver'), false);
});
