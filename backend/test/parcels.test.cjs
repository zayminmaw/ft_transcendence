const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { ParcelsModule } = require('../dist/modules/parcels');
const { ParcelsRepository } = require('../dist/modules/parcels/parcels.repository');
const { hashPassword } = require('../dist/modules/users/password');
const { PASSWORD, as, createAuthApp, createFakeStore, tokenFor } = require('./helpers/auth-app.cjs');

process.env.NODE_ENV = 'test';

// A DTO as the values it holds: its left-out fields are undefined keys.
const sent = (dto) => Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined));

function parcelRow(id, values = {}) {
  return {
    id, trackingNumber: `TRC-ABCDEFGH${id}`, status: 'pickup_scheduled', client: { id: '7', code: 'PAPER', name: 'Paper & Co.' },
    driver: null, vehicle: null, run: null, recipientName: 'Maya N.', recipientPhone: '+962 7 9555 0101', recipientSecondaryPhone: null,
    deliveryAddress: '22 Rainbow Street', deliveryCityZone: 'Central', deliveryLandmark: null, weightKg: '1.20', isFragile: false,
    deliveryFee: '7.00', codAmount: '120.00', deliveryAttemptCount: 0, failedReasonCode: null,
    createdAt: new Date('2026-11-01T00:00:00Z'), updatedAt: new Date('2026-11-01T00:00:00Z'), ...values,
  };
}

// The repository answers what the test sets in `next` and records every call, so the test sees what the API passed
// down: which company, and the values after validation.
function fakeParcels() {
  const calls = [];
  const next = {};
  const answer = (name, fallback) => (...args) => {
    calls.push([name, ...args.filter((arg) => typeof arg !== 'function')]);
    return Promise.resolve(name in next ? next[name] : fallback);
  };
  return {
    calls,
    next,
    repository: {
      list: answer('list', { items: [parcelRow('1')], total: 1 }),
      counts: answer('counts', { statuses: { pickup_scheduled: 1 }, driversOut: 0 }),
      find: answer('find', { ...parcelRow('1'), events: [] }),
      formOptions: answer('formOptions', { clients: [], zones: [] }),
      dispatchDrivers: answer('dispatchDrivers', []),
      create: answer('create', { status: 'created', parcel: parcelRow('2') }),
      move: answer('move', { status: 'updated', parcel: parcelRow('1', { status: 'picked_up' }) }),
      assign: answer('assign', { status: 'updated', parcel: parcelRow('1', { status: 'out_for_delivery' }) }),
    },
  };
}

const newParcel = (values = {}) => ({
  clientId: '7', recipientName: ' Maya N. ', recipientPhone: '+962 7 9555 0101', recipientSecondaryPhone: '', deliveryAddress: '22 Rainbow Street',
  deliveryCityZone: 'Central', deliveryLandmark: '  ', weightKg: '1.5', isFragile: true, deliveryFee: '7', codAmount: '120.5', ...values,
});

// Meridian (company 1): dana is a dispatcher (every parcel permission), sami a hub sorter (view and status), farah in
// finance (view only), omar has no parcel permission. Harbor (company 2): karim is a dispatcher there.
async function parcelsApp(t) {
  const passwordHash = await hashPassword(PASSWORD);
  const store = createFakeStore();
  const parcels = fakeParcels();
  store.rolePermissions.set('1', new Set(['parcels.view', 'parcels.create', 'parcels.dispatch', 'parcels.update_status']));
  store.rolePermissions.set('2', new Set(['parcels.view', 'parcels.update_status']));
  store.rolePermissions.set('3', new Set(['parcels.view']));
  store.rolePermissions.set('4', new Set(['drivers.view']));
  const people = [['10', 'dana', '1', '1'], ['11', 'sami', '1', '2'], ['12', 'farah', '1', '3'], ['13', 'omar', '1', '4'], ['14', 'karim', '2', '1']];
  for (const [id, username, organizationId, roleId] of people) {
    store.users.push({ id, username, email: `${username}@demo.example.test`, passwordHash, isActive: true, lastLoginAt: null });
    store.memberships.push({ organizationId, userId: id, roleId, isActive: true });
  }
  const { server } = await createAuthApp(t, store, { imports: [ParcelsModule], overrides: [[ParcelsRepository, parcels.repository]] });
  const tokens = {};
  for (const [, username] of people) tokens[username] = await tokenFor(server, username);
  return { server, parcels, tokens };
}

test('the list: company scoped, with defaults, counts and validated filters', async (t) => {
  const { server, parcels, tokens } = await parcelsApp(t);
  const list = (await as(request(server).get('/api/parcels'), tokens.farah).expect(200)).body;
  assert.deepEqual([list.items.length, list.total, list.page, list.pageSize, list.counts.driversOut], [1, 1, 1, 10, 0]);
  const [name, company, query] = parcels.calls.find(([call]) => call === 'list');
  assert.deepEqual([name, company, sent(query)], ['list', '1', { queue: 'all', sort: 'createdAt', direction: 'desc', page: 1, pageSize: 10 }]);

  await as(request(server).get('/api/parcels?queue=exceptions&search=%20trc%20&sort=merchant&direction=asc&pageSize=25'), tokens.farah).expect(200);
  assert.deepEqual(sent(parcels.calls.filter(([call]) => call === 'list').at(-1)[2]), {
    queue: 'exceptions', search: 'trc', sort: 'merchant', direction: 'asc', page: 1, pageSize: 25,
  });
  await as(request(server).get('/api/parcels?queue=in_hub_sorted'), tokens.farah).expect(200);
  for (const query of ['queue=lost', 'sort=recipientPhone', 'pageSize=7', 'page=0', 'direction=up']) {
    await as(request(server).get(`/api/parcels?${query}`), tokens.farah).expect(400);
  }
  await as(request(server).get('/api/parcels'), tokens.karim, '2').expect(200);
  assert.equal(parcels.calls.filter(([call]) => call === 'list').at(-1)[1], '2');
});

test('each change needs its own permission; no parcels.view, no parcels', async (t) => {
  const { server, tokens } = await parcelsApp(t);
  for (const path of ['/api/parcels', '/api/parcels/1', '/api/parcels/dispatch-drivers']) await as(request(server).get(path), tokens.omar).expect(403);
  await as(request(server).get('/api/parcels/form-options'), tokens.sami).expect(403);
  await as(request(server).post('/api/parcels').send(newParcel()), tokens.sami).expect(403);
  await as(request(server).post('/api/parcels/1/assignment').send({ driverId: '3' }), tokens.sami).expect(403);
  await as(request(server).post('/api/parcels/1/status').send({ status: 'picked_up' }), tokens.farah).expect(403);
  await as(request(server).get('/api/parcels/form-options'), tokens.dana).expect(200);
  await as(request(server).get('/api/parcels/dispatch-drivers'), tokens.farah).expect(200);
  await as(request(server).post('/api/parcels/1/status').send({ status: 'picked_up' }), tokens.sami).expect(200);
});

test('a new parcel: trimmed, amounts as saved, optional details cleared, the creator recorded', async (t) => {
  const { server, parcels, tokens } = await parcelsApp(t);
  const created = (await as(request(server).post('/api/parcels').send(newParcel({ notes: ' Call first ' })), tokens.dana).expect(201)).body;
  assert.equal(created.id, '2');
  const [, company, actor, values, notes] = parcels.calls.find(([call]) => call === 'create');
  assert.deepEqual([company, actor, notes], ['1', '10', 'Call first']);
  assert.deepEqual(values, {
    clientId: '7', recipientName: 'Maya N.', recipientPhone: '+962 7 9555 0101', recipientSecondaryPhone: null, deliveryAddress: '22 Rainbow Street',
    deliveryCityZone: 'Central', deliveryLandmark: null, weightKg: '1.50', isFragile: true, deliveryFee: '7.00', codAmount: '120.50',
  });

  for (const bad of [
    { weightKg: '0' }, { weightKg: '0.00' }, { weightKg: '1.234' }, { deliveryFee: '-1' }, { codAmount: 12 }, { clientId: 'abc' },
    { recipientPhone: 'call me' }, { recipientName: '  ' }, { deliveryCityZone: '' }, { organizationId: '2' },
  ]) {
    await as(request(server).post('/api/parcels').send(newParcel(bad)), tokens.dana).expect(400);
  }
  parcels.next.create = { status: 'client_unavailable' };
  const refused = (await as(request(server).post('/api/parcels').send(newParcel()), tokens.dana).expect(400)).body;
  assert.equal(refused.code, 'PARCEL_CLIENT_UNAVAILABLE');
});

test('status moves name what each step needs; a parcel that moved on is a conflict', async (t) => {
  const { server, parcels, tokens } = await parcelsApp(t);
  const move = (body, id = '1') => as(request(server).post(`/api/parcels/${id}/status`).send(body), tokens.sami);
  for (const bad of [
    { status: 'in_hub_sorted' }, { status: 'in_hub_sorted', hubLocation: ' ' }, { status: 'failed_attempt' },
    { status: 'failed_attempt', reasonCode: 'lazy' }, { status: 'returned_to_sender' }, { status: 'returned_to_sender', notes: '  ' },
    { status: 'out_for_delivery' }, { status: 'delivered' }, { status: 'draft' },
  ]) await move(bad).expect(400);
  await move({ status: 'in_hub_sorted', hubLocation: ' Bay 3 ' }).expect(200);
  await move({ status: 'failed_attempt', reasonCode: 'refused', notes: '' }).expect(200);
  await move({ status: 'returned_to_sender', notes: ' Refused twice ' }).expect(200);
  const moves = parcels.calls.filter(([call]) => call === 'move').map(([, company, id, actor, body]) => [company, id, actor, sent(body)]);
  assert.deepEqual(moves, [
    ['1', '1', '11', { status: 'in_hub_sorted', hubLocation: 'Bay 3' }],
    ['1', '1', '11', { status: 'failed_attempt', reasonCode: 'refused', notes: null }],
    ['1', '1', '11', { status: 'returned_to_sender', notes: 'Refused twice' }],
  ]);

  parcels.next.move = { status: 'wrong_status' };
  assert.equal((await move({ status: 'picked_up' }).expect(409)).body.code, 'PARCEL_WRONG_STATUS');
  parcels.next.move = { status: 'not_found' };
  await move({ status: 'picked_up' }).expect(404);
  // A malformed id never reaches the repository.
  const before = parcels.calls.length;
  await move({ status: 'picked_up' }, 'abc').expect(404);
  await as(request(server).get('/api/parcels/0'), tokens.sami).expect(404);
  assert.equal(parcels.calls.length, before);
});

test('an assignment names a driver; one off duty or elsewhere is a conflict', async (t) => {
  const { server, parcels, tokens } = await parcelsApp(t);
  const assign = (body) => as(request(server).post('/api/parcels/1/assignment').send(body), tokens.dana);
  for (const bad of [{}, { driverId: 'abc' }, { driverId: 3 }, { driverId: '3', vehicleId: '9' }]) await assign(bad).expect(400);
  const out = (await assign({ driverId: '3', notes: ' Fragile ' }).expect(200)).body;
  assert.equal(out.status, 'out_for_delivery');
  assert.deepEqual(parcels.calls.find(([call]) => call === 'assign').slice(1), ['1', '1', '10', '3', 'Fragile']);
  parcels.next.assign = { status: 'driver_unavailable' };
  assert.equal((await assign({ driverId: '3' }).expect(409)).body.code, 'PARCEL_DRIVER_UNAVAILABLE');
});
