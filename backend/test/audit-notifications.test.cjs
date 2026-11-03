const { test } = require('node:test');
const assert = require('node:assert/strict');
const { notificationFor } = require('../dist/modules/notifications/audit-notifications');

const event = (overrides = {}) => ({
	id: '1', occurredAt: '2026-10-30T00:00:00.000Z', organizationId: '1', actorId: '10', module: 'members',
	action: 'update', resourceType: 'member', recordId: '12', category: 'data', severity: 'info', outcome: 'success',
	...overrides,
});

test('a committed company change reaches the people who may view that resource', () => {
	assert.deepEqual(notificationFor(event()), [
		{ organizationId: '1', permission: 'admin.manage_users' },
		{ action: 'UPDATE', module: 'members', resourceId: '12' },
	]);
	assert.equal(notificationFor(event({ action: 'create' }))[1].action, 'CREATE');
	assert.equal(notificationFor(event({ action: 'delete' }))[1].action, 'DELETE');
	assert.equal(notificationFor(event({ action: 'password_reset' }))[1].action, 'UPDATE');
});

test('sign-ins, reads, refusals and resources nobody watches notify no one', () => {
	assert.equal(notificationFor(event({ module: 'auth', action: 'login', resourceType: 'user', organizationId: null })), null);
	assert.equal(notificationFor(event({ module: 'audit', action: 'read', resourceType: 'audit_log' })), null);
	assert.equal(notificationFor(event({ outcome: 'denied' })), null);
	assert.equal(notificationFor(event({ module: 'platform', resourceType: 'tenant' })), null);
	assert.equal(notificationFor(event({ recordId: 'abc' })), null);
	assert.equal(notificationFor(event({ recordId: null })), null);
});
