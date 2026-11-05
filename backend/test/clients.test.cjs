const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { ClientsModule } = require('../dist/modules/clients');
const { hashPassword } = require('../dist/modules/users/password');
const { PASSWORD, as, createAuthApp, createFakeStore, tokenFor } = require('./helpers/auth-app.cjs');

process.env.NODE_ENV = 'test';

const ALL = ['clients.view', 'clients.create', 'clients.edit', 'clients.delete', 'clients.view_financials'];
const FINANCIALS = ['currentBalance', 'pendingCodBalance', 'rateProfileTier'];

function clientRow(id, organizationId, values = {}) {
  return {
    id, organizationId, clientCode: `CL-000${id}`, businessName: `Business ${id}`, tradeLicenseNo: null,
    contactPersonName: `Contact ${id}`, contactTitle: null, mobile1: `+962 7 9555 01${id}0`, mobile2: null,
    email: `client${id}@example.test`, billingAddress: 'Billing street', defaultPickupAddress: 'Pickup street',
    pickupLatitude: null, pickupLongitude: null, currentBalance: '10.00', pendingCodBalance: '5.00', rateProfileTier: 'standard',
    operationalNotes: null, isActive: true, createdAt: new Date(`2026-0${id}-01T00:00:00Z`), updatedAt: new Date('2026-10-01T00:00:00Z'),
    ...values,
  };
}

const newClient = (values = {}) => ({
  clientCode: 'cl-0100', businessName: '  Cedar Books  ', tradeLicenseNo: '', contactPersonName: 'Hala Aziz', contactTitle: null,
  mobile1: '+962 7 9000 1111', mobile2: '', email: 'hala@cedar.example.test', billingAddress: '1 Rainbow Street, Amman',
  defaultPickupAddress: '1 Rainbow Street, Amman', pickupLatitude: '31.95', pickupLongitude: '35.9', operationalNotes: '', ...values,
});

// Meridian (company 1): lina is the admin, dana a dispatcher (no financials, no archiving), omar a hub sorter (no
// clients at all). Harbor (company 2): karim is its admin.
async function clientsApp(t) {
  const passwordHash = await hashPassword(PASSWORD);
  const store = createFakeStore();
  store.rolePermissions.set('1', new Set(ALL));
  store.rolePermissions.set('2', new Set(['clients.view', 'clients.create', 'clients.edit']));
  store.rolePermissions.set('3', new Set(['parcels.view']));
  for (const [id, username, organizationId, roleId] of [['10', 'lina', '1', '1'], ['12', 'dana', '1', '2'], ['13', 'omar', '1', '3'], ['15', 'karim', '2', '1']]) {
    store.users.push({ id, username, email: `${username}@demo.example.test`, passwordHash, isActive: true, lastLoginAt: null });
    store.memberships.push({ organizationId, userId: id, roleId, isActive: true });
  }
  store.clients.push(
    clientRow('1', '1', { businessName: 'Paper & Co.', pickupLatitude: '31.87012400', pickupLongitude: '36.00521300' }),
    clientRow('2', '1', { businessName: 'Atlas Sportswear' }),
    clientRow('3', '1', { businessName: 'Bloom Florists', isActive: false, pickupLatitude: '31.94580100', pickupLongitude: '35.88302500' }),
    clientRow('4', '2', { businessName: 'Harbor Merchant' }),
  );
  const { server } = await createAuthApp(t, store, { imports: [ClientsModule] });
  const tokens = {};
  for (const username of ['lina', 'dana', 'omar', 'karim']) tokens[username] = await tokenFor(server, username);
  return { server, store, tokens };
}

test('the client list: active clients by name, company counts, search, paging and status filters', async (t) => {
  const { server, tokens } = await clientsApp(t);
  const list = (await as(request(server).get('/api/clients'), tokens.lina).expect(200)).body;
  assert.deepEqual(list.items.map((client) => client.businessName), ['Atlas Sportswear', 'Paper & Co.']);
  assert.deepEqual([list.total, list.page, list.pageSize], [2, 1, 10]);
  // Over the whole company, whatever the filter; Bloom is archived, so its pin doesn't count.
  assert.deepEqual(list.counts, { total: 3, active: 2, archived: 1, pinned: 1 });
  assert.equal(list.items[0].organizationId, undefined);

  const names = async (query) => (await as(request(server).get(`/api/clients?${query}`), tokens.lina).expect(200)).body.items
    .map((client) => client.businessName);
  assert.deepEqual(await names('status=archived'), ['Bloom Florists']);
  assert.deepEqual(await names('status=all&sort=businessName&direction=desc'), ['Paper & Co.', 'Bloom Florists', 'Atlas Sportswear']);
  assert.deepEqual(await names('status=all&sort=createdAt'), ['Paper & Co.', 'Atlas Sportswear', 'Bloom Florists']);
  assert.deepEqual(await names('search=cl-0002'), ['Atlas Sportswear']);
  assert.deepEqual(await names('search=contact 1'), ['Paper & Co.']);
  const second = (await as(request(server).get('/api/clients?status=all&pageSize=10&page=2'), tokens.lina).expect(200)).body;
  assert.deepEqual([second.items.length, second.total, second.page], [0, 3, 2]);

  for (const query of ['status=deleted', 'sort=email', 'pageSize=7', 'page=0', 'direction=up']) {
    await as(request(server).get(`/api/clients?${query}`), tokens.lina).expect(400);
  }
  // Harbor sees only its own merchant.
  const harbor = (await as(request(server).get('/api/clients'), tokens.karim, '2').expect(200)).body;
  assert.deepEqual(harbor.items.map((client) => client.businessName), ['Harbor Merchant']);
  assert.deepEqual(harbor.counts, { total: 1, active: 1, archived: 0, pinned: 0 });
});

test('balances and the rate tier only for clients.view_financials; no clients.view, no clients', async (t) => {
  const { server, tokens } = await clientsApp(t);
  const admin = (await as(request(server).get('/api/clients/1'), tokens.lina).expect(200)).body;
  assert.deepEqual(FINANCIALS.map((field) => admin[field]), ['10.00', '5.00', 'standard']);
  const dispatcher = (await as(request(server).get('/api/clients/1'), tokens.dana).expect(200)).body;
  for (const field of FINANCIALS) assert.equal(field in dispatcher, false, field);
  assert.equal(dispatcher.pickupLatitude, '31.87012400');
  const listed = (await as(request(server).get('/api/clients'), tokens.dana).expect(200)).body.items;
  for (const field of FINANCIALS) assert.equal(field in listed[0], false, field);

  await as(request(server).get('/api/clients'), tokens.omar).expect(403);
  await as(request(server).get('/api/clients/1'), tokens.omar).expect(403);
  await as(request(server).post('/api/clients').send(newClient()), tokens.omar).expect(403);
});

test('another company\'s client, an unknown id and a malformed id are all simply not found', async (t) => {
  const { server, tokens } = await clientsApp(t);
  for (const id of ['4', '99', 'abc', '0', '1.5']) {
    const response = await as(request(server).get(`/api/clients/${id}`), tokens.lina).expect(404);
    assert.equal(response.body.code, 'CLIENT_NOT_FOUND');
  }
  await as(request(server).patch('/api/clients/4').send({ businessName: 'Taken over' }), tokens.lina).expect(404);
  await as(request(server).post('/api/clients/4/archive'), tokens.lina).expect(404);
});

test('creating a client: cleaned values, the code once per company, the tier only with financials, audited', async (t) => {
  const { server, store, tokens } = await clientsApp(t);
  const created = (await as(request(server).post('/api/clients').send(newClient({ rateProfileTier: 'priority' })), tokens.lina).expect(201)).body;
  assert.equal(created.clientCode, 'CL-0100');
  assert.equal(created.businessName, 'Cedar Books');
  assert.deepEqual([created.tradeLicenseNo, created.mobile2, created.operationalNotes], [null, null, null]);
  assert.deepEqual([created.pickupLatitude, created.pickupLongitude], ['31.95000000', '35.90000000']);
  assert.deepEqual([created.currentBalance, created.pendingCodBalance, created.rateProfileTier, created.isActive], ['0.00', '0.00', 'priority', true]);
  const entry = store.auditEntries.at(-1);
  assert.deepEqual(
    [entry.module, entry.action, entry.resourceType, entry.recordId, entry.organizationId, entry.actorId, entry.before],
    ['clients', 'create', 'client', created.id, '1', '10', null],
  );
  assert.equal(entry.after.clientCode, 'CL-0100');

  const taken = await as(request(server).post('/api/clients').send(newClient({ clientCode: 'CL-0100' })), tokens.lina).expect(409);
  assert.equal(taken.body.code, 'CLIENT_CODE_TAKEN');
  // Codes are per company: Harbor may use the same one.
  await as(request(server).post('/api/clients').send(newClient()), tokens.karim, '2').expect(201);

  // A dispatcher can add merchants, on the standard tier, but can't choose the tier.
  const refused = await as(request(server).post('/api/clients').send(newClient({ clientCode: 'CL-0200', rateProfileTier: 'corporate' })), tokens.dana).expect(403);
  assert.equal(refused.body.code, 'CLIENT_FINANCIALS_FORBIDDEN');
  const standard = (await as(request(server).post('/api/clients').send(newClient({ clientCode: 'CL-0200' })), tokens.dana).expect(201)).body;
  assert.equal('rateProfileTier' in standard, false);
  assert.equal(store.clients.find((client) => client.id === standard.id).rateProfileTier, 'standard');
});

test('a new client is refused when a value breaks the form\'s rules', async (t) => {
  const { server, store, tokens } = await clientsApp(t);
  const before = store.clients.length;
  const invalid = [
    { clientCode: 'C' }, { clientCode: 'CL 01' }, { businessName: '   ' }, { mobile1: 'call me' }, { mobile2: '12' },
    { email: 'not-an-email' }, { billingAddress: '' }, { pickupLatitude: '91', pickupLongitude: '35' },
    { pickupLatitude: '31.123456789', pickupLongitude: '35' }, { pickupLongitude: '181', pickupLatitude: '31' },
    { rateProfileTier: 'gold' }, { currentBalance: '1000000.00' }, { isActive: false }, { businessName: 'x'.repeat(192) },
  ];
  for (const values of invalid) {
    await as(request(server).post('/api/clients').send(newClient(values)), tokens.lina).expect(400);
  }
  for (const values of [{ pickupLatitude: '' }, { pickupLongitude: null }]) {
    const response = await as(request(server).post('/api/clients').send(newClient(values)), tokens.lina).expect(400);
    assert.equal(response.body.code, 'CLIENT_COORDINATES_UNPAIRED');
  }
  const withoutContact = newClient();
  delete withoutContact.contactPersonName;
  await as(request(server).post('/api/clients').send(withoutContact), tokens.lina).expect(400);
  assert.equal(store.clients.length, before);
});

test('editing a client: only what changed is saved and audited; the same values change nothing', async (t) => {
  const { server, store, tokens } = await clientsApp(t);
  const updated = (await as(request(server).patch('/api/clients/2').send({ businessName: 'Atlas Sports', contactTitle: 'Owner' }), tokens.dana).expect(200)).body;
  assert.deepEqual([updated.businessName, updated.contactTitle, updated.clientCode], ['Atlas Sports', 'Owner', 'CL-0002']);
  const entry = store.auditEntries.at(-1);
  assert.deepEqual([entry.action, entry.recordId, entry.before.businessName, entry.after.businessName], ['update', '2', 'Atlas Sportswear', 'Atlas Sports']);

  const audited = store.auditEntries.length;
  // The saved pin typed differently is the same pin.
  await as(request(server).patch('/api/clients/1').send({ pickupLatitude: '31.870124', pickupLongitude: '36.005213', businessName: 'Paper & Co.' }), tokens.dana)
    .expect(200);
  assert.equal(store.auditEntries.length, audited);

  // "" clears an optional detail; null can't clear a required one.
  store.clients.find((client) => client.id === '2').tradeLicenseNo = 'CR-1';
  assert.equal((await as(request(server).patch('/api/clients/2').send({ tradeLicenseNo: '' }), tokens.dana).expect(200)).body.tradeLicenseNo, null);
  await as(request(server).patch('/api/clients/2').send({ businessName: null }), tokens.dana).expect(400);
  // Removing the pin takes both coordinates.
  const unpaired = await as(request(server).patch('/api/clients/1').send({ pickupLatitude: null }), tokens.dana).expect(400);
  assert.equal(unpaired.body.code, 'CLIENT_COORDINATES_UNPAIRED');
  const unpinned = (await as(request(server).patch('/api/clients/1').send({ pickupLatitude: null, pickupLongitude: null }), tokens.dana).expect(200)).body;
  assert.deepEqual([unpinned.pickupLatitude, unpinned.pickupLongitude], [null, null]);

  const taken = await as(request(server).patch('/api/clients/2').send({ clientCode: 'cl-0001' }), tokens.dana).expect(409);
  assert.equal(taken.body.code, 'CLIENT_CODE_TAKEN');
  // Its own code again is no conflict.
  await as(request(server).patch('/api/clients/2').send({ clientCode: 'CL-0002' }), tokens.dana).expect(200);

  const tier = await as(request(server).patch('/api/clients/2').send({ rateProfileTier: 'corporate' }), tokens.dana).expect(403);
  assert.equal(tier.body.code, 'CLIENT_FINANCIALS_FORBIDDEN');
  assert.equal((await as(request(server).patch('/api/clients/2').send({ rateProfileTier: 'corporate' }), tokens.lina).expect(200)).body.rateProfileTier, 'corporate');
  await as(request(server).patch('/api/clients/2').send({ currentBalance: '0.00' }), tokens.lina).expect(400);
  await as(request(server).patch('/api/clients/2').send({ businessName: 'No access' }), tokens.omar).expect(403);
});

test('archiving and reactivating need clients.delete, and asking twice changes nothing', async (t) => {
  const { server, store, tokens } = await clientsApp(t);
  await as(request(server).post('/api/clients/2/archive'), tokens.dana).expect(403);
  const archived = (await as(request(server).post('/api/clients/2/archive'), tokens.lina).expect(200)).body;
  assert.equal(archived.isActive, false);
  const entry = store.auditEntries.at(-1);
  assert.deepEqual([entry.action, entry.recordId, entry.before, entry.after], ['status_change', '2', { isActive: true }, { isActive: false }]);

  const audited = store.auditEntries.length;
  assert.equal((await as(request(server).post('/api/clients/2/archive'), tokens.lina).expect(200)).body.isActive, false);
  assert.equal(store.auditEntries.length, audited);

  assert.equal((await as(request(server).post('/api/clients/2/reactivate'), tokens.lina).expect(200)).body.isActive, true);
  assert.equal(store.auditEntries.at(-1).after.isActive, true);
});
