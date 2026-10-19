require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ForbiddenException } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const { JwtService } = require('@nestjs/jwt');
const { io } = require('socket.io-client');
const { EventsGateway } = require('../dist/modules/notifications/events.gateway');
const { CorsIoAdapter } = require('../dist/modules/notifications/cors-io.adapter');
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
	const policy = { async canAccess(roleId, permission) { return permission === 'parcels.view' && grants[roleId] === 'all'; } };

	const module = await Test.createTestingModule({ providers: [
		EventsGateway,
		{ provide: JwtService, useValue: jwt },
		{ provide: OrganizationMembersService, useValue: members },
		{ provide: PermissionPolicyService, useValue: policy },
	] }).compile();
	const app = module.createNestApplication({ logger: false });
	app.useWebSocketAdapter(new CorsIoAdapter(app, 'http://localhost:5173'));
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
	await assert.rejects(connect({ token: token('7', -1), organizationId: '1' }), /Unauthorized/);
	await assert.rejects(connect({ token: token('7') }), /Unauthorized/);
	await assert.rejects(connect({ token: token('7'), organizationId: 'abc' }), /Unauthorized/);
	await assert.rejects(connect({ token: token('7'), organizationId: '2' }), /Unauthorized/);

	const orgOneViewer = await connect({ token: token('7'), organizationId: '1' });
	const orgOneWithoutPermission = await connect({ token: token('8'), organizationId: '1' });
	const orgTwoMember = await connect({ token: token('8'), organizationId: '2' });
	const orgTwoOtherUser = await connect({ token: token('9'), organizationId: '2' });

	const gateway = app.get(EventsGateway);
	await gateway.sendNotification({ organizationId: '1', permission: 'parcels.view' }, { action: 'CREATE', module: 'parcels', data: { id: '10' } });
	await gateway.sendNotification({ organizationId: '2', permission: 'parcels.view', userId: '9' }, { action: 'UPDATE', module: 'parcels', data: { id: '20' } });
	await gateway.sendNotification({ organizationId: '2', permission: 'billing.view' }, { action: 'UPDATE', module: 'billing', data: { id: '30' } });
	await assert.rejects(gateway.sendNotification({ organizationId: '', permission: 'parcels.view' }, { action: 'CREATE', module: 'parcels', data: {} }));
	await new Promise((resolve) => setTimeout(resolve, 100));

	assert.deepEqual(orgOneViewer.received.map((payload) => [payload.organizationId, payload.data.id]), [['1', '10']]);
	assert.deepEqual(orgOneWithoutPermission.received, []);
	assert.deepEqual(orgTwoMember.received, []);
	assert.deepEqual(orgTwoOtherUser.received.map((payload) => [payload.organizationId, payload.data.id]), [['2', '20']]);
});
