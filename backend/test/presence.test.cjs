require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ForbiddenException } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const { JwtService } = require('@nestjs/jwt');
const { io } = require('socket.io-client');
const { EventsGateway } = require('../dist/modules/notifications/events.gateway');
const { PRESENCE_GRACE_MS, PresenceService } = require('../dist/modules/notifications/presence.service');
const { ContactsRepository } = require('../dist/modules/contacts/contacts.repository');
const { OrganizationMembersService } = require('../dist/modules/organizations/organization-members.service');
const { PermissionPolicyService } = require('../dist/modules/rbac/permission-policy.service');

const GRACE_MS = 400;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, what, timeoutMs = 3000) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) assert.fail(`timed out waiting for ${what}`);
    await wait(10);
  }
}

// Meridian (company 1) and Harbor (company 2). Dana (10) saved Omar (11) at Meridian, Karim (20) saved Omar at Harbor,
// and Noor (13) saved nobody. Omar works at both.
async function app(t) {
  const jwt = new JwtService({ secret: 'test-secret-with-at-least-32-characters', signOptions: { issuer: 'transcend', audience: 'transcend-web', algorithm: 'HS256' }, verifyOptions: { issuer: 'transcend', audience: 'transcend-web', algorithms: ['HS256'] } });
  // company -> user -> active
  const memberships = { 1: { 10: true, 11: true, 13: true }, 2: { 11: true, 20: true } };
  const saved = [['1', '10', '11'], ['2', '20', '11']];
  const members = {
    async requireActiveMembership(userId, organizationId) {
      if (!memberships[organizationId]?.[userId]) throw new ForbiddenException('Inactive membership');
      return { organizationId, roleId: '2' };
    },
    async isActiveMember(userId, organizationId) { return memberships[organizationId]?.[userId] === true; },
  };
  const contacts = {
    async viewersOf(organizationId, contactUserId) {
      return saved.filter(([organization, , contact]) => organization === organizationId && contact === contactUserId).map(([, owner]) => owner);
    },
  };
  const moduleRef = await Test.createTestingModule({ providers: [
    EventsGateway, PresenceService,
    { provide: PRESENCE_GRACE_MS, useValue: GRACE_MS },
    { provide: JwtService, useValue: jwt },
    { provide: OrganizationMembersService, useValue: members },
    { provide: PermissionPolicyService, useValue: { canAccess: async () => true } },
    { provide: ContactsRepository, useValue: contacts },
  ] }).compile();
  const nest = moduleRef.createNestApplication({ logger: false });
  await nest.listen(0, '127.0.0.1');
  const url = `http://127.0.0.1:${nest.getHttpServer().address().port}`;
  const sockets = [];
  t.after(async () => { sockets.forEach((socket) => socket.disconnect()); await nest.close(); });
  const connect = (userId, organizationId) => new Promise((resolve, reject) => {
    const socket = io(url, { auth: { token: jwt.sign({ sub: userId }, { expiresIn: '15m' }), organizationId }, transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(socket);
    socket.received = [];
    socket.on('presence', (payload) => socket.received.push(payload));
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
  return { connect, memberships, presence: nest.get(PresenceService) };
}
const summary = (socket) => socket.received.map(({ organizationId, userId, status }) => [organizationId, userId, status]);

test('a viewer who saved someone is told when that person comes online and when they go offline after the grace', async (t) => {
  const { connect } = await app(t);
  const dana = await connect('10', '1');
  const omar = await connect('11', '1');
  await until(() => dana.received.length === 1, 'Omar online');
  assert.deepEqual(summary(dana), [['1', '11', 'online']]);
  omar.disconnect();
  // Inside the grace nobody is told.
  await wait(GRACE_MS / 2);
  assert.equal(dana.received.length, 1);
  await until(() => dana.received.length === 2, 'Omar offline');
  assert.deepEqual(summary(dana), [['1', '11', 'online'], ['1', '11', 'offline']]);
});

test('only people who saved that person are told, in their own room', async (t) => {
  const { connect } = await app(t);
  const dana = await connect('10', '1');
  const noor = await connect('13', '1');
  await connect('11', '1');
  await until(() => dana.received.length === 1, 'Omar online');
  await wait(100);
  // Noor is in the same company but never saved Omar. Omar's own socket is not told about himself either.
  assert.deepEqual(noor.received, []);
});

test("a person online in another company only is offline here, and company 1's viewers hear nothing about company 2", async (t) => {
  const { connect, presence } = await app(t);
  const dana = await connect('10', '1');
  const karim = await connect('20', '2');
  await connect('11', '2');
  await until(() => karim.received.length === 1, 'Omar online at Harbor');
  assert.deepEqual(summary(karim), [['2', '11', 'online']]);
  await wait(100);
  assert.deepEqual(dana.received, []);
  assert.equal(await presence.statusOf('2', '11'), 'online');
  assert.equal(await presence.statusOf('1', '11'), 'offline');
});

test("refresh sends suspended and closes the person's sockets when their membership is inactive, and reactivation recomputes from sockets", async (t) => {
  const { connect, memberships, presence } = await app(t);
  const dana = await connect('10', '1');
  const omar = await connect('11', '1');
  await until(() => dana.received.length === 1, 'Omar online');
  const closed = new Promise((resolve) => omar.on('disconnect', resolve));
  memberships[1][11] = false;
  await presence.refresh('1', '11');
  assert.equal(await closed, 'io server disconnect');
  await until(() => dana.received.length === 2, 'Omar suspended');
  assert.deepEqual(summary(dana).at(-1), ['1', '11', 'suspended']);
  assert.equal(await presence.statusOf('1', '11'), 'suspended');
  // Reactivated and back inside the grace: the registry sees no change, so only refresh can say Online again.
  memberships[1][11] = true;
  await connect('11', '1');
  await presence.refresh('1', '11');
  await until(() => dana.received.length === 3, 'Omar online again');
  assert.deepEqual(summary(dana).at(-1), ['1', '11', 'online']);
});

test('a presence event carries no names, only ids and the status', async (t) => {
  const { connect } = await app(t);
  const dana = await connect('10', '1');
  await connect('11', '1');
  await until(() => dana.received.length === 1, 'Omar online');
  assert.deepEqual(Object.keys(dana.received[0]).sort(), ['organizationId', 'status', 'timestamp', 'userId']);
  assert.ok(!Number.isNaN(Date.parse(dana.received[0].timestamp)));
});

test("closeCompany disconnects every socket of that company and no one else's", async (t) => {
  const { connect, presence } = await app(t);
  const dana = await connect('10', '1');
  const noor = await connect('13', '1');
  const karim = await connect('20', '2');
  const closed = (socket) => new Promise((resolve) => socket.on('disconnect', resolve));
  const danaClosed = closed(dana);
  const noorClosed = closed(noor);
  await presence.closeCompany('1');
  assert.equal(await danaClosed, 'io server disconnect');
  assert.equal(await noorClosed, 'io server disconnect');
  await wait(100);
  assert.equal(karim.connected, true);
});
