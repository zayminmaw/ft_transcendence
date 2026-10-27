const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { AuditLog } = require('../../dist/modules/audit/entities/audit-log.entity');
const { AuditService } = require('../../dist/modules/audit/audit.service');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');
const { Role } = require('../../dist/modules/rbac/entities/role.entity');
const { User } = require('../../dist/modules/users/entities/user.entity');

let database;
let audit;
let actorId;
let organizationId;
before(async () => {
	database = await createTestDatabase();
	audit = new AuditService(database.getRepository(AuditLog));
	const actor = await database.getRepository(User).save({ username: 'audit.actor', email: 'audit.actor@db.test', passwordHash: 'placeholder-hash' });
	actorId = actor.id;
	const platformRole = await database.getRepository(Role).findOneByOrFail({ code: 'platform_admin' });
	await database.query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [actorId, platformRole.id]);
	organizationId = (await database.getRepository(Organization).save({ name: 'Audit Co', slug: 'audit-co', contactEmail: 'ops@audit.test' })).id;
});
after(() => database?.destroy());

const rows = (where) => database.getRepository(AuditLog).find({ where, order: { id: 'ASC' } });
const DAY = 86_400_000;

test('the migration brings legacy rows to the shared vocabulary and names their actors', async () => {
	await database.undoLastMigration();
	const legacy = [
		['auth', 'login_failed', null, null],
		['members', 'member_deactivated', null, null],
		['platform', 'tenant.create', null, { name: 'Legacy Co', contactEmail: 'owner@legacy.test', contactPhone: '+66 81 234 5678', address: '1 Main St', administrator: { id: '1', username: 'boss', email: 'boss@legacy.test' } }],
		['platform', 'tenant.update', { name: 'Old' }, { name: 'New' }],
	];
	for (const [module, action, oldValues, newValues] of legacy) {
		// The member change was made by audit.actor, the others by nobody known.
		await database.query('INSERT INTO audit_logs (module, action, user_id, old_values, new_values) VALUES (?, ?, ?, ?, ?)', [
			module, action, module === 'members' ? actorId : null, oldValues && JSON.stringify(oldValues), newValues && JSON.stringify(newValues),
		]);
	}
	await database.runMigrations();

	const migrated = await database.query(`SELECT module, action, resource_type, actor_name, category, severity, outcome, old_values, new_values,
		occurred_at IS NOT NULL AS has_time, retain_until > NOW() AS kept FROM audit_logs ORDER BY id`);
	const parse = (value) => (typeof value === 'string' ? JSON.parse(value) : value);
	assert.deepEqual(migrated.map((row) => [row.module, row.action, row.resource_type, row.category, row.severity, row.outcome]), [
		['auth', 'login_failed', 'user', 'security', 'warning', 'failure'],
		['members', 'status_change', 'member', 'data', 'info', 'success'],
		['platform', 'create', 'tenant', 'platform', 'info', 'success'],
		['platform', 'update', 'tenant', 'platform', 'info', 'success'],
	]);
	assert.deepEqual(parse(migrated[1].old_values), { isActive: true });
	assert.deepEqual(migrated.map((row) => row.actor_name), [null, 'audit.actor', null, null]);
	assert.deepEqual(parse(migrated[2].new_values), {
		name: 'Legacy Co', contactEmail: 'owner@legacy.test', contactPhone: '+66 81 234 5678', address: '1 Main St',
		administrator: { id: '1', username: 'boss', email: 'boss@legacy.test' },
	});
	assert.ok(migrated.every((row) => Number(row.has_time) === 1 && Number(row.kept) === 1));
});

test('the foreign keys are gone and the append-only triggers are in place', async () => {
	const [{ total: foreignKeys }] = await database.query(`SELECT COUNT(*) AS total FROM information_schema.referential_constraints
		WHERE constraint_schema = DATABASE() AND table_name = 'audit_logs'`);
	assert.equal(Number(foreignKeys), 0);
	const triggers = await database.query(`SELECT trigger_name AS name FROM information_schema.triggers
		WHERE trigger_schema = DATABASE() AND event_object_table = 'audit_logs' ORDER BY trigger_name`);
	assert.deepEqual(triggers.map((row) => row.name), ['audit_logs_no_update', 'audit_logs_retention']);
});

test('a row is written in the change\'s transaction with the actor, allowlisted fields and retention', async () => {
	await database.transaction((manager) => audit.record(manager, {
		module: 'platform', action: 'update', resourceType: 'tenant', recordId: organizationId, organizationId, actorId,
		resourceLabel: 'Audit Co',
		before: { name: 'Audit Co', contactEmail: 'ops@audit.test', address: 'A', slug: 'audit-co', internalNote: 'x' },
		after: { name: 'Audit Co', contactEmail: 'help@audit.test', address: 'B', slug: 'audit-co', internalNote: 'y' },
		params: { reason: 'rebrand', password: 'hunter2', nested: { no: 1 } },
		meta: { ip: '10.0.0.1', userAgent: 'db-test' },
	}));
	const [row] = await rows({ module: 'platform', action: 'update', recordId: organizationId });
	assert.equal(row.userId, actorId);
	assert.equal(row.actorName, 'audit.actor');
	assert.equal(row.actorRole, 'platform_admin');
	assert.equal(row.actorType, 'user');
	assert.equal(row.source, 'system');
	assert.equal(row.ipAddress, '10.0.0.1');
	assert.equal(row.resourceLabel, 'Audit Co');
	// Only what changed, as it is (the company sees its own data); an unlisted field never reaches the row.
	assert.deepEqual(row.oldValues, { contactEmail: 'ops@audit.test', address: 'A' });
	assert.deepEqual(row.newValues, { contactEmail: 'help@audit.test', address: 'B' });
	assert.deepEqual(row.metadata, { reason: 'rebrand', password: '[REDACTED]' });
	const days = (row.retainUntil.getTime() - row.occurredAt.getTime()) / DAY;
	assert.ok(days > 179 && days < 181, `expected about 180 days, got ${days}`);
});

test('a rolled-back change leaves no audit row and tells no listener', async () => {
	const heard = [];
	const unsubscribe = audit.subscribe((event) => heard.push(event.action));
	await assert.rejects(database.transaction(async (manager) => {
		await audit.record(manager, { module: 'members', action: 'delete', resourceType: 'member', recordId: 'rolled-back', organizationId });
		throw new Error('change failed');
	}));
	assert.equal((await rows({ recordId: 'rolled-back' })).length, 0);

	await database.transaction(async (manager) => {
		await audit.record(manager, { module: 'members', action: 'create', resourceType: 'member', recordId: 'committed', organizationId });
		assert.deepEqual(heard, [], 'listeners wait for the commit');
	});
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(heard, ['create']);
	unsubscribe();
});

test('rows can\'t be changed, and can be deleted only after their retention', async () => {
	await audit.recordStandalone({ module: 'auth', action: 'login', resourceType: 'user', recordId: actorId, actorId });
	const [row] = await rows({ module: 'auth', action: 'login', recordId: actorId });
	await assert.rejects(database.query('UPDATE audit_logs SET action = ? WHERE id = ?', ['logout', row.id]), /append-only/);
	await assert.rejects(database.query('DELETE FROM audit_logs WHERE id = ?', [row.id]), /retain_until/);

	await database.query(`INSERT INTO audit_logs (module, action, occurred_at, retain_until)
		VALUES ('auth', 'logout', UTC_TIMESTAMP(), UTC_TIMESTAMP() - INTERVAL 1 DAY)`);
	const [expired] = await rows({ module: 'auth', action: 'logout' });
	await database.query('DELETE FROM audit_logs WHERE id = ?', [expired.id]);
	assert.equal((await rows({ id: expired.id })).length, 0);
});

test('history keeps the actor after the account is deleted', async () => {
	const gone = await database.getRepository(User).save({ username: 'gone.user', email: 'gone@db.test', passwordHash: 'placeholder-hash' });
	await audit.recordStandalone({ module: 'auth', action: 'logout', resourceType: 'session', recordId: gone.id, actorId: gone.id });
	await database.getRepository(User).delete({ id: gone.id });
	const [row] = await rows({ recordId: gone.id });
	assert.equal(row.userId, gone.id);
	assert.equal(row.actorName, 'gone.user');
});

test('an unknown resource type is refused instead of stored without an allowlist', async () => {
	await assert.rejects(audit.recordStandalone({ module: 'x', action: 'create', resourceType: 'mystery' }), /Unknown audit resource/);
});
