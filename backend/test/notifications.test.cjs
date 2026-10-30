require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ForbiddenException } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const { JwtService } = require('@nestjs/jwt');
const { io } = require('socket.io-client');
const { EventsGateway } = require('../dist/modules/notifications/events.gateway');
const { OrganizationMembersService } = require('../dist/modules/organizations/organization-members.service');
const { PermissionPolicyService } = require('../dist/modules/rbac/permission-policy.service');

test('WebSocket notifications reach only authenticated, authorized members of the target organization', async (t) => {
	const jwt = new JwtService({ secret: 'test-secret-with-at-least-32-characters', signOptions: { issuer: 'transcend', audience: 'transcend-web', algorithm: 'HS256' }, verifyOptions: { issuer: 'transcend', audience: 'transcend-web', algorithms: ['HS256'] } });
	// user -> organization -> role
	const memberships = { 7: { 1: '3' }, 8: { 1: '4', 2: '5' }, 9: { 2: '5' } };
	const members = { async requireActiveMembership(userId, organizationId) {
		const roleId = memberships[userId]?.[organizationId];
		if (!roleId) throw new ForbiddenException('Inactive membership');
		return { organizationId, roleId };
	} };
	// Role 4 lacks parcels.view.
	const grants = { 3: 'all', 5: 'all' };
	const policy = { async canAccess(roleId, permission) {
		if (permission === 'broken.view') throw new Error('database unavailable');
		return permission === 'parcels.view' && grants[roleId] === 'all';
	} };

	const module = await Test.createTestingModule({ providers: [
		EventsGateway,
		{ provide: JwtService, useValue: jwt },
		{ provide: OrganizationMembersService, useValue: members },
		{ provide: PermissionPolicyService, useValue: policy },
	] }).compile();
	const app = module.createNestApplication({ logger: false });
	await app.listen(0, '127.0.0.1');
	const url = `http://127.0.0.1:${app.getHttpServer().address().port}`;
	const sockets = [];
	t.after(async () => { sockets.forEach((socket) => socket.disconnect()); await app.close(); });

	const connect = (auth) => new Promise((resolve, reject) => {
		const socket = io(url, { auth, transports: ['websocket'], reconnection: false, forceNew: true });
		sockets.push(socket);
		socket.received = [];
		socket.on('notification', (payload) => socket.received.push(payload));
		socket.on('connect', () => resolve(socket));
		socket.on('connect_error', reject);
	});
	const token = (sub, expiresIn = '15m') => jwt.sign({ sub }, { expiresIn });

	await assert.rejects(connect({}), /Unauthorized/);
	await assert.rejects(connect({ token: 'malformed', organizationId: '1' }), /Unauthorized/);
	// Only an expired token says so: it is the one refusal a refreshed token fixes.
	await assert.rejects(connect({ token: token('7', -1), organizationId: '1' }), /TokenExpired/);
	await assert.rejects(connect({ token: token('7') }), /Unauthorized/);
	await assert.rejects(connect({ token: token('7'), organizationId: 'abc' }), /Unauthorized/);
	await assert.rejects(connect({ token: token('7'), organizationId: '2' }), /Unauthorized/);
	// Like HTTP, nothing but the password change until an admin-given password is replaced.
	await assert.rejects(connect({ token: jwt.sign({ sub: '7', mustChangePassword: true }, { expiresIn: '15m' }), organizationId: '1' }), /Unauthorized/);

	const orgOneViewer = await connect({ token: token('7'), organizationId: '1' });
	const orgOneWithoutPermission = await connect({ token: token('8'), organizationId: '1' });
	const orgTwoMember = await connect({ token: token('8'), organizationId: '2' });
	const orgTwoOtherUser = await connect({ token: token('9'), organizationId: '2' });

	const gateway = app.get(EventsGateway);
	await gateway.sendNotification({ organizationId: '1', permission: 'parcels.view' }, { action: 'CREATE', module: 'parcels', resourceId: '10' });
	await gateway.sendNotification({ organizationId: '2', permission: 'parcels.view', userId: '9' }, { action: 'UPDATE', module: 'parcels', resourceId: '20' });
	await gateway.sendNotification({ organizationId: '2', permission: 'billing.view' }, { action: 'UPDATE', module: 'billing', resourceId: '30' });
	// A failed lookup is logged, never thrown at the sender, whose change is already saved.
	await gateway.sendNotification({ organizationId: '1', permission: 'broken.view' }, { action: 'UPDATE', module: 'parcels', resourceId: '40' });
	await assert.rejects(gateway.sendNotification({ organizationId: '', permission: 'parcels.view' }, { action: 'CREATE', module: 'parcels', resourceId: '1' }));
	await assert.rejects(gateway.sendNotification({ organizationId: '1', permission: 'parcels.view' }, { action: 'CREATE', module: 'parcels', resourceId: 'x' }));
	await new Promise((resolve) => setTimeout(resolve, 100));

	assert.deepEqual(orgOneViewer.received.map((payload) => [payload.organizationId, payload.resourceId]), [['1', '10']]);
	assert.deepEqual(orgOneWithoutPermission.received, []);
	assert.deepEqual(orgTwoMember.received, []);
	assert.deepEqual(orgTwoOtherUser.received.map((payload) => [payload.organizationId, payload.resourceId]), [['2', '20']]);
	assert.deepEqual(Object.keys(orgOneViewer.received[0]).sort(), ['action', 'module', 'organizationId', 'resourceId', 'timestamp']);

	// The server closes a socket when its access token expires, so a revoked membership cannot keep it open.
	const shortLived = await connect({ token: token('7', '2s'), organizationId: '1' });
	const reason = await new Promise((resolve) => shortLived.on('disconnect', resolve));
	assert.equal(reason, 'io server disconnect');
});

test('canAccess allows only permissions granted with the all scope', async () => {
	const scopes = { 'parcels.view': 'all', 'parcels.update_status': 'assigned_only' };
	const policy = new PermissionPolicyService({ async findScope(roleId, permission) { return scopes[permission]; } });
	assert.equal(await policy.canAccess('3', 'parcels.view'), true);
	assert.equal(await policy.canAccess('3', 'parcels.update_status'), false);
	assert.equal(await policy.canAccess('3', 'billing.view'), false);
});
