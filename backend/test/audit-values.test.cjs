const { test } = require('node:test');
const assert = require('node:assert/strict');
const { auditParams, auditValues, maskForPlatform } = require('../dist/modules/audit/audit-values');
const { defaultSeverity, retainUntil } = require('../dist/modules/audit/audit-policy');

const RULES = { status: 'plain', total: 'plain', email: 'maskEmail', address: 'redact', due: 'plain', client: { id: 'plain', email: 'maskEmail' } };

test('an update keeps only allowlisted fields that changed, as they are', () => {
	const before = { status: 'draft', total: '10.00', email: 'a@b.com', address: 'X', notes: 'secret plan', due: new Date('2026-10-01T00:00:00Z') };
	const after = { status: 'void', total: '10.00', email: 'c@b.com', address: 'X', notes: 'other', due: new Date('2026-10-01T00:00:00Z') };
	assert.deepEqual(auditValues(RULES, before, after, true), {
		oldValues: { status: 'draft', email: 'a@b.com' },
		newValues: { status: 'void', email: 'c@b.com' },
	});
	assert.deepEqual(auditValues(RULES, { status: 'paid' }, { status: 'paid' }, true), { oldValues: null, newValues: null });
});

test('other actions keep the whole allowlisted snapshot, nested rules included', () => {
	const after = { status: 'paid', client: { id: '7', email: 'pay@co.test', password: 'x' }, token: 't' };
	assert.deepEqual(auditValues(RULES, null, after), {
		oldValues: null,
		newValues: { status: 'paid', client: { id: '7', email: 'pay@co.test' } },
	});
	assert.deepEqual(auditValues(RULES, { address: '1 Main St' }, null), { oldValues: { address: '1 Main St' }, newValues: null });
});

test('the platform sees personal data masked; unknown fields are withheld', () => {
	assert.deepEqual(
		maskForPlatform(RULES, { status: 'paid', email: 'jane@co.test', address: '1 Main St', client: { id: '7', email: 'pay@co.test' }, extra: 'x' }),
		{ status: 'paid', email: 'j***@c***.test', address: '[REDACTED]', client: { id: '7', email: 'p***@c***.test' }, extra: '[REDACTED]' },
	);
	assert.deepEqual(maskForPlatform(RULES, { email: null }), { email: null });
});

test('a plain value never carries a denied key, and params keep short scalars only', () => {
	assert.deepEqual(auditValues({ meta: 'plain' }, null, { meta: { refreshToken: 'r', ok: true } }).newValues, { meta: { refreshToken: '[REDACTED]', ok: true } });
	assert.deepEqual(auditParams({ installment: 'Final Payment', count: 2, secret: 's', nested: { a: 1 }, long: 'x'.repeat(200) }), {
		installment: 'Final Payment', count: 2, secret: '[REDACTED]', long: 'x'.repeat(128),
	});
});

test('severity and retention follow the action and category', () => {
	assert.equal(defaultSeverity('session_reuse', 'success'), 'critical');
	assert.equal(defaultSeverity('login_failed', 'failure'), 'warning');
	assert.equal(defaultSeverity('read', 'denied'), 'warning');
	assert.equal(defaultSeverity('delete', 'success'), 'notice');
	assert.equal(defaultSeverity('update', 'success'), 'info');
	const start = new Date('2026-01-01T00:00:00Z');
	const days = (date) => (date.getTime() - start.getTime()) / 86_400_000;
	assert.equal(days(retainUntil(start, 'access', 'info')), 90);
	assert.equal(days(retainUntil(start, 'data', 'info')), 180);
	assert.equal(days(retainUntil(start, 'data', 'critical')), 365);
	assert.equal(days(retainUntil(start, 'security', 'warning')), 365);
});
