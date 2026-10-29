const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { hashPassword } = require('../dist/modules/users/password');
const { ORIGIN, createAuthApp, createFakeStore } = require('./helpers/auth-app.cjs');

process.env.NODE_ENV = 'test';
const PASSWORD = 'Correct-horse-1';

function row(id, fields) {
	return {
		id, organizationId: '1', userId: '10', actorName: 'lina', actorRole: 'org_admin', actorType: 'user',
		module: 'billing', action: 'status_change', resourceType: 'invoice', recordId: '17', resourceLabel: 'INV-2026-0017',
		category: 'data', severity: 'info', outcome: 'success', source: 'web', ipAddress: '172.18.0.2', userAgent: 'test',
		requestId: 'req-1', oldValues: { status: 'draft' }, newValues: { status: 'void' }, metadata: null,
		occurredAt: new Date('2026-10-17T13:50:45.000Z'), ...fields,
	};
}

// Meridian (company 1): lina is org_admin (admin.audit_logs), dana a dispatcher. Harbor (company 2): karim.
// zara is a platform administrator.
async function auditApp(t) {
	const passwordHash = await hashPassword(PASSWORD);
	const store = createFakeStore();
	store.rolePermissions.set('1', new Set(['admin.audit_logs']));
	store.rolePermissions.set('2', new Set(['parcels.view']));
	for (const [id, username, organizationId, roleId] of [['10', 'lina', '1', '1'], ['12', 'dana', '1', '2'], ['15', 'karim', '2', '1'], ['14', 'zara', '1', '2']]) {
		store.users.push({ id, username, email: `${username}@demo.example.test`, passwordHash, isActive: true });
		store.memberships.push({ organizationId, userId: id, roleId, isActive: true });
	}
	store.platformAdmins.add('14');
	store.auditRows.push(
		row('1'),
		row('2', { recordId: '18', resourceLabel: 'INV-2026-0018' }),
		row('3', { organizationId: '2', userId: '15', actorName: 'karim' }),
		row('4', { userId: '12', actorName: 'dana', module: 'parcels', resourceType: 'parcel', recordId: '5' }),
		row('5', { module: 'platform', resourceType: 'tenant', category: 'platform', userId: '14', oldValues: { name: 'Old' }, newValues: { name: 'New' } }),
		row('6', { module: 'audit', action: 'read', resourceType: 'audit_log', recordId: null, resourceLabel: null, category: 'access', oldValues: null, newValues: null }),
	);
	return { store, ...(await createAuthApp(t, store)) };
}

async function tokenFor(server, login) {
	return (await request(server).post('/api/auth/login').set('Origin', ORIGIN).send({ login, password: PASSWORD }).expect(200)).body.accessToken;
}
const as = (call, token, company = '1') => call.set('Authorization', `Bearer ${token}`).set('X-Organization-Id', company);
const reads = (store) => store.auditEntries.filter((entry) => entry.module === 'audit');

test('the company log shows only that company, and the read is audited', async (t) => {
	const { server, store } = await auditApp(t);
	const lina = await tokenFor(server, 'lina');
	const page = (await as(request(server).get('/api/audit-logs'), lina).expect(200)).body;
	assert.deepEqual(page.items.map((item) => item.id), ['1', '2', '4', '5']);
	assert.equal(page.total, 4);
	assert.deepEqual(page.items[0], {
		id: '1', occurredAt: '2026-10-17T13:50:45.000Z', organizationId: '1',
		actor: { id: '10', name: 'lina', role: 'org_admin', type: 'user' },
		module: 'billing', action: 'status_change', resource: { type: 'invoice', id: '17', label: 'INV-2026-0017' },
		params: {}, changes: { status: { before: 'draft', after: 'void' } },
		category: 'data', severity: 'info', outcome: 'success', source: 'web', ip: '172.18.0.2', requestId: 'req-1',
	});
	assert.deepEqual(reads(store).at(-1), {
		module: 'audit', action: 'read', resourceType: 'audit_log', params: { scope: 'tenant', results: 4, filters: '' },
	});
});

test('one record\'s history uses the same endpoint', async (t) => {
	const { server, store } = await auditApp(t);
	const lina = await tokenFor(server, 'lina');
	const page = (await as(request(server).get('/api/audit-logs?resourceType=invoice&recordId=18,99'), lina).expect(200)).body;
	assert.deepEqual(page.items.map((item) => item.id), ['2']);
	assert.equal(reads(store).at(-1).params.filters, 'resourceType=invoice&recordId=18,99');
});

test('another company\'s entry is not found, and details include the user agent', async (t) => {
	const { server } = await auditApp(t);
	const lina = await tokenFor(server, 'lina');
	await as(request(server).get('/api/audit-logs/3'), lina).expect(404);
	await as(request(server).get('/api/audit-logs/abc'), lina).expect(404);
	const detail = (await as(request(server).get('/api/audit-logs/1'), lina).expect(200)).body;
	assert.equal(detail.userAgent, 'test');
});

test('without admin.audit_logs the read is refused and the attempt is audited', async (t) => {
	const { server, store } = await auditApp(t);
	const dana = await tokenFor(server, 'dana');
	await as(request(server).get('/api/audit-logs'), dana).expect(403);
	// dana is a Meridian member, so Meridian's administrators see the attempt.
	assert.deepEqual(reads(store).at(-1), {
		module: 'audit', action: 'read', resourceType: 'audit_log', outcome: 'denied', organizationId: '1',
	});
	// The company header can't widen it: dana is not a member of Harbor, and the attempt names no company.
	await as(request(server).get('/api/audit-logs'), dana, '2').expect(403);
	assert.equal(reads(store).at(-1).organizationId, null);
});

test('reads of the trail are kept out of the log unless asked for', async (t) => {
	const { server } = await auditApp(t);
	const lina = await tokenFor(server, 'lina');
	const all = (await as(request(server).get('/api/audit-logs'), lina).expect(200)).body;
	assert.equal(all.items.some((item) => item.id === '6'), false);
	const reads = (await as(request(server).get('/api/audit-logs?module=audit'), lina).expect(200)).body;
	assert.deepEqual(reads.items.map((item) => item.id), ['6']);
});

test('a company sees what platform staff changed, not where they connected from', async (t) => {
	const { server } = await auditApp(t);
	const lina = await tokenFor(server, 'lina');
	const zara = await tokenFor(server, 'zara');
	const tenantRow = (await as(request(server).get('/api/audit-logs/5'), lina).expect(200)).body;
	assert.deepEqual([tenantRow.ip, tenantRow.userAgent], [null, null]);
	assert.equal((await as(request(server).get('/api/audit-logs/1'), lina).expect(200)).body.ip, '172.18.0.2');
	const platformRow = (await request(server).get('/api/platform/audit-logs/5').set('Authorization', `Bearer ${zara}`).expect(200)).body;
	assert.deepEqual([platformRow.ip, platformRow.userAgent], ['172.18.0.2', 'test']);
});

test('the company sees the details of its people; the platform sees them masked', async (t) => {
	const { server, store } = await auditApp(t);
	const administrator = { id: '15', username: 'karim', email: 'karim@harbor.example.test' };
	store.auditRows.push(row('7', {
		module: 'platform', action: 'assign', resourceType: 'tenant_administrator', category: 'platform', userId: '14',
		oldValues: null, newValues: { administrator, role: 'org_admin' },
	}));
	const lina = await tokenFor(server, 'lina');
	const zara = await tokenFor(server, 'zara');
	const forCompany = (await as(request(server).get('/api/audit-logs/7'), lina).expect(200)).body;
	assert.deepEqual(forCompany.changes.administrator.after, administrator);
	const forPlatform = (await request(server).get('/api/platform/audit-logs/7').set('Authorization', `Bearer ${zara}`).expect(200)).body;
	assert.deepEqual(forPlatform.changes.administrator.after, { id: '15', username: 'karim', email: 'k***@h***.test' });
	assert.equal(forPlatform.changes.role.after, 'org_admin');
});

test('the access check answers without adding to the trail', async (t) => {
	const { server, store } = await auditApp(t);
	const lina = await tokenFor(server, 'lina');
	const dana = await tokenFor(server, 'dana');
	assert.deepEqual((await as(request(server).get('/api/audit-logs/access'), lina).expect(200)).body, { canRead: true });
	await as(request(server).get('/api/audit-logs/access'), dana).expect(403);
	assert.deepEqual(reads(store), []);
});

test('"my activity" lists only what you did yourself', async (t) => {
	const { server } = await auditApp(t);
	const dana = await tokenFor(server, 'dana');
	const page = (await request(server).get('/api/audit-logs/mine').set('Authorization', `Bearer ${dana}`).expect(200)).body;
	assert.deepEqual(page.items.map((item) => item.id), ['4']);
});

test('the platform sees every company, but not the values of company business data', async (t) => {
	const { server, store } = await auditApp(t);
	const zara = await tokenFor(server, 'zara');
	const lina = await tokenFor(server, 'lina');
	const page = (await request(server).get('/api/platform/audit-logs').set('Authorization', `Bearer ${zara}`).expect(200)).body;
	assert.equal(page.total, 5);
	assert.equal(page.items.find((item) => item.id === '1').changes, null);
	assert.deepEqual(page.items.find((item) => item.id === '5').changes, { name: { before: 'Old', after: 'New' } });
	assert.equal(reads(store).at(-1).params.scope, 'platform');
	await request(server).get('/api/platform/audit-logs').set('Authorization', `Bearer ${lina}`).expect(403);
});

test('filters are validated', async (t) => {
	const { server } = await auditApp(t);
	const lina = await tokenFor(server, 'lina');
	await as(request(server).get('/api/audit-logs?action=drop_table'), lina).expect(400);
	await as(request(server).get('/api/audit-logs?pageSize=1000'), lina).expect(400);
	await as(request(server).get('/api/audit-logs?resourceType=Invoice;--'), lina).expect(400);
	const paged = (await as(request(server).get('/api/audit-logs?pageSize=2&page=2'), lina).expect(200)).body;
	assert.deepEqual([paged.items.map((item) => item.id), paged.total, paged.page, paged.pageSize], [['4', '5'], 4, 2, 2]);
});
