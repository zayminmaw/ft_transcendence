const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { AssetsModule } = require('../dist/modules/assets');
const { AssetsRepository } = require('../dist/modules/assets/assets.repository');
const { hashPassword } = require('../dist/modules/users/password');
const { PASSWORD, as, createAuthApp, createFakeStore, tokenFor } = require('./helpers/auth-app.cjs');
const { createFakeAssets } = require('./helpers/fake-assets.cjs');

process.env.NODE_ENV = 'test';

const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

function assetRow(id, organizationId, values = {}) {
  return {
    id, organizationId, assetTag: `AST-00${id}`, assetName: `Asset ${id}`, category: 'van', acquisitionCost: '24500.00',
    currentBookValue: '19600.00', licensePlate: null, vin: null, insurancePolicyNumber: null, roadTaxExpiry: null, currentCondition: 'good',
    notes: null, assignments: [], maintenanceLogs: [], createdAt: new Date('2025-01-01T00:00:00Z'), updatedAt: new Date('2026-10-01T00:00:00Z'),
    ...values,
  };
}
const checkedOut = (driverId, driverName) => ({
  id: '90', driverId, driverName, checkedOutAt: new Date('2026-10-29T07:30:00Z'), checkedInAt: null, checkoutNotes: null, checkinNotes: null,
});

const newAsset = (values = {}) => ({
  assetTag: ' ast-100 ', assetName: ' Honda Wave 110 ', category: 'motorcycle', currentCondition: 'new', acquisitionCost: '1450',
  currentBookValue: '1450.5', licensePlate: '31-11902', vin: '', insurancePolicyNumber: null, roadTaxExpiry: '2027-09-15', notes: '', ...values,
});
const service = (values = {}) => ({
  serviceDate: '2026-11-10', serviceType: ' Oil change ', serviceCost: '85', vendorServiceCenter: '', nextServiceDue: '2027-02-10', notes: null,
  condition: 'good', ...values,
});

// Meridian (company 1): maya is the fleet lead (everything), dana a dispatcher (view and assign), vic only views,
// omar sees no assets. Harbor (company 2): karim is its fleet lead.
async function assetsApp(t) {
  const passwordHash = await hashPassword(PASSWORD);
  const store = createFakeStore();
  const assets = createFakeAssets();
  store.rolePermissions.set('1', new Set(['assets.view', 'assets.create', 'assets.assign', 'assets.log_maintenance']));
  store.rolePermissions.set('2', new Set(['assets.view', 'assets.assign']));
  store.rolePermissions.set('3', new Set(['parcels.view']));
  store.rolePermissions.set('4', new Set(['assets.view']));
  const people = [['10', 'maya', '1', '1'], ['12', 'dana', '1', '2'], ['13', 'omar', '1', '3'], ['14', 'vic', '1', '4'], ['15', 'karim', '2', '1']];
  for (const [id, username, organizationId, roleId] of people) {
    store.users.push({ id, username, email: `${username}@demo.example.test`, passwordHash, isActive: true, lastLoginAt: null });
    store.memberships.push({ organizationId, userId: id, roleId, isActive: true });
  }
  assets.rows.push(
    assetRow('1', '1', { assetName: 'Toyota Hiace', roadTaxExpiry: day(10), assignments: [checkedOut('21', 'Leen Mansour')] }),
    assetRow('2', '1', { assetName: 'Zebra scanner', category: 'barcode_scanner', currentCondition: 'needs_maintenance' }),
    assetRow('3', '1', { assetName: 'Honda Wave', category: 'motorcycle', currentCondition: 'new', roadTaxExpiry: day(-5) }),
    assetRow('4', '1', { assetName: 'Old Honda', category: 'motorcycle', currentCondition: 'decommissioned', roadTaxExpiry: day(-100) }),
    assetRow('5', '2', { assetName: 'Harbor van' }),
  );
  assets.drivers.push(
    { organizationId: '1', id: '21', name: 'Leen Mansour', working: true },
    { organizationId: '1', id: '22', name: 'Samir Farah', working: true },
    { organizationId: '1', id: '23', name: 'Gone Away', working: false },
    { organizationId: '2', id: '31', name: 'Tariq Aziz', working: true },
  );
  const { server } = await createAuthApp(t, store, { imports: [AssetsModule], overrides: [[AssetsRepository, assets.repository]] });
  const tokens = {};
  for (const [, username] of people) tokens[username] = await tokenFor(server, username);
  return { server, store, tokens };
}

test('the asset list: by tag, company counts, search, filters and paging', async (t) => {
  const { server, tokens } = await assetsApp(t);
  const list = (await as(request(server).get('/api/assets'), tokens.vic).expect(200)).body;
  assert.deepEqual(list.items.map((asset) => asset.assetTag), ['AST-001', 'AST-002', 'AST-003', 'AST-004']);
  assert.deepEqual([list.total, list.page, list.pageSize], [4, 1, 10]);
  assert.deepEqual(list.counts, { inService: 3, checkedOut: 1, needsMaintenance: 1, decommissioned: 1, roadTaxDue: 2 });
  assert.equal(list.items[0].holder.driverName, 'Leen Mansour');
  assert.equal(list.items[0].organizationId, undefined);

  const tags = async (query) => (await as(request(server).get(`/api/assets?${query}`), tokens.vic).expect(200)).body.items
    .map((asset) => asset.assetTag);
  assert.deepEqual(await tags('status=available'), ['AST-003']);
  assert.deepEqual(await tags('status=checked_out'), ['AST-001']);
  assert.deepEqual(await tags('status=decommissioned'), ['AST-004']);
  assert.deepEqual(await tags('search=leen'), ['AST-001']);
  assert.deepEqual(await tags('sort=assetName&direction=desc'), ['AST-002', 'AST-001', 'AST-004', 'AST-003']);
  for (const query of ['status=lost', 'sort=vin', 'pageSize=7', 'page=0', 'direction=up']) {
    await as(request(server).get(`/api/assets?${query}`), tokens.vic).expect(400);
  }
  const harbor = (await as(request(server).get('/api/assets'), tokens.karim, '2').expect(200)).body;
  assert.deepEqual(harbor.items.map((asset) => asset.assetName), ['Harbor van']);
});

test('one asset with its history; another company\'s, an unknown and a malformed id are simply not found', async (t) => {
  const { server, tokens } = await assetsApp(t);
  const van = (await as(request(server).get('/api/assets/1'), tokens.vic).expect(200)).body;
  assert.deepEqual([van.holder.driverId, van.assignments.length, van.maintenanceLogs, van.nextServiceDue], ['21', 1, [], null]);
  for (const id of ['5', '99', 'abc', '0']) {
    assert.equal((await as(request(server).get(`/api/assets/${id}`), tokens.maya).expect(404)).body.code, 'ASSET_NOT_FOUND');
  }
  await as(request(server).patch('/api/assets/5').send({ assetName: 'Taken over' }), tokens.maya).expect(404);
  await as(request(server).post('/api/assets/5/check-in').send({ condition: 'good' }), tokens.maya).expect(404);
  await as(request(server).post('/api/assets/5/maintenance').send(service()), tokens.maya).expect(404);
});

test('each action needs its permission', async (t) => {
  const { server, tokens } = await assetsApp(t);
  for (const path of ['/api/assets', '/api/assets/1']) await as(request(server).get(path), tokens.omar).expect(403);
  await as(request(server).post('/api/assets').send(newAsset()), tokens.dana).expect(403);
  await as(request(server).patch('/api/assets/3').send({ assetName: 'X' }), tokens.dana).expect(403);
  await as(request(server).post('/api/assets/3/check-out').send({ driverId: '22' }), tokens.vic).expect(403);
  await as(request(server).post('/api/assets/1/check-in').send({ condition: 'good' }), tokens.vic).expect(403);
  await as(request(server).post('/api/assets/3/maintenance').send(service()), tokens.dana).expect(403);
  // The dispatcher checks assets out and in.
  await as(request(server).post('/api/assets/3/check-out').send({ driverId: '22' }), tokens.dana).expect(200);
  await as(request(server).post('/api/assets/3/check-in').send({ condition: 'good' }), tokens.dana).expect(200);
});

test('adding an asset: cleaned values, defaults, audited; the tag is unique per company', async (t) => {
  const { server, store, tokens } = await assetsApp(t);
  const created = (await as(request(server).post('/api/assets').send(newAsset()), tokens.maya).expect(201)).body;
  assert.deepEqual(
    [created.assetTag, created.assetName, created.acquisitionCost, created.currentBookValue, created.vin, created.notes, created.holder],
    ['AST-100', 'Honda Wave 110', '1450.00', '1450.50', null, null, null],
  );
  const entry = store.auditEntries.at(-1);
  assert.deepEqual(
    [entry.module, entry.action, entry.resourceType, entry.recordId, entry.resourceLabel, entry.actorId, entry.before],
    ['assets', 'create', 'asset', created.id, 'AST-100', '10', null],
  );
  assert.equal(entry.after.assetTag, 'AST-100');
  assert.equal('holder' in entry.after, false);

  const plain = (await as(request(server).post('/api/assets').send({ assetTag: 'AST-101', assetName: 'Bag', category: 'thermal_bag' }), tokens.maya)
    .expect(201)).body;
  assert.deepEqual([plain.currentCondition, plain.acquisitionCost, plain.roadTaxExpiry], ['good', '0.00', null]);
  assert.equal((await as(request(server).post('/api/assets').send(newAsset({ assetTag: 'ast-001' })), tokens.maya).expect(409)).body.code, 'ASSET_TAG_TAKEN');
  await as(request(server).post('/api/assets').send(newAsset({ assetTag: 'AST-001' })), tokens.karim, '2').expect(201);
});

test('a new asset is validated like the form', async (t) => {
  const { server, tokens } = await assetsApp(t);
  const invalid = [
    { assetTag: 'A' }, { assetTag: 'AST 1' }, { assetName: '  ' }, { category: 'rocket' }, { currentCondition: 'broken' },
    { acquisitionCost: '-1' }, { currentBookValue: '1.234' }, { acquisitionCost: 12 }, { roadTaxExpiry: '2027-02-30' },
    { licensePlate: 'x'.repeat(33) }, { notes: 'x'.repeat(2001) }, { organizationId: '2' }, { holder: null },
  ];
  for (const values of invalid) {
    await as(request(server).post('/api/assets').send(newAsset(values)), tokens.maya).expect(400);
  }
});

test('editing saves what changed; an asset a driver has is not decommissioned', async (t) => {
  const { server, store, tokens } = await assetsApp(t);
  const edited = (await as(request(server).patch('/api/assets/3').send({ assetName: ' Honda Wave 125 ', acquisitionCost: '24500' }), tokens.maya)
    .expect(200)).body;
  assert.equal(edited.assetName, 'Honda Wave 125');
  const entry = store.auditEntries.at(-1);
  assert.deepEqual([entry.action, entry.before.assetName, entry.after.assetName], ['update', 'Honda Wave', 'Honda Wave 125']);
  assert.equal(entry.after.acquisitionCost, entry.before.acquisitionCost);

  const refused = await as(request(server).patch('/api/assets/1').send({ currentCondition: 'decommissioned' }), tokens.maya).expect(409);
  assert.equal(refused.body.code, 'ASSET_CHECKED_OUT');
  assert.equal((await as(request(server).patch('/api/assets/3').send({ assetTag: 'AST-002' }), tokens.maya).expect(409)).body.code, 'ASSET_TAG_TAKEN');
  for (const values of [{ assetName: null }, { category: null }, { holder: null }, { assetTag: 'A' }]) {
    await as(request(server).patch('/api/assets/3').send(values), tokens.maya).expect(400);
  }
  const retired = (await as(request(server).patch('/api/assets/3').send({ currentCondition: 'decommissioned' }), tokens.maya).expect(200)).body;
  assert.equal(retired.currentCondition, 'decommissioned');
});

test('check-out and check-in: one driver at a time, a working driver of the company, audited', async (t) => {
  const { server, store, tokens } = await assetsApp(t);
  const out = (await as(request(server).post('/api/assets/3/check-out').send({ driverId: '22', notes: ' Helmet included ' }), tokens.dana)
    .expect(200)).body;
  assert.deepEqual([out.holder.driverId, out.holder.driverName, out.holder.checkoutNotes], ['22', 'Samir Farah', 'Helmet included']);
  let entry = store.auditEntries.at(-1);
  assert.deepEqual(
    [entry.action, entry.before, entry.after],
    ['assign', { holder: null }, { holder: { driverId: '22', driverName: 'Samir Farah' } }],
  );

  const code = async (call, status) => (await as(call, tokens.dana).expect(status)).body.code;
  assert.equal(await code(request(server).post('/api/assets/3/check-out').send({ driverId: '21' }), 409), 'ASSET_ALREADY_CHECKED_OUT');
  assert.equal(await code(request(server).post('/api/assets/4/check-out').send({ driverId: '21' }), 409), 'ASSET_DECOMMISSIONED');
  // A terminated driver, another company's driver and an unknown one can't take it.
  for (const driverId of ['23', '31', '99']) {
    assert.equal(await code(request(server).post('/api/assets/2/check-out').send({ driverId }), 400), 'ASSET_DRIVER_UNAVAILABLE');
  }
  for (const body of [{}, { driverId: 'abc' }, { driverId: 22 }]) {
    await as(request(server).post('/api/assets/2/check-out').send(body), tokens.dana).expect(400);
  }

  const back = (await as(request(server).post('/api/assets/3/check-in').send({ condition: 'needs_maintenance', notes: 'Chain loose' }), tokens.dana)
    .expect(200)).body;
  assert.deepEqual([back.holder, back.currentCondition, back.assignments[0].checkinNotes], [null, 'needs_maintenance', 'Chain loose']);
  entry = store.auditEntries.at(-1);
  assert.deepEqual(
    [entry.action, entry.before, entry.after],
    ['revoke', { holder: { driverId: '22', driverName: 'Samir Farah' }, currentCondition: 'new' }, { holder: null, currentCondition: 'needs_maintenance' }],
  );
  assert.equal(await code(request(server).post('/api/assets/3/check-in').send({ condition: 'good' }), 409), 'ASSET_NOT_CHECKED_OUT');
  // Only back as good or needing maintenance: retiring is an edit.
  for (const condition of ['decommissioned', 'new', undefined]) {
    await as(request(server).post('/api/assets/1/check-in').send({ condition }), tokens.dana).expect(400);
  }
});

test('logging a service: the condition it left in, the next service due, audited; never for a decommissioned asset', async (t) => {
  const { server, store, tokens } = await assetsApp(t);
  const serviced = (await as(request(server).post('/api/assets/2/maintenance').send(service()), tokens.maya).expect(200)).body;
  assert.deepEqual([serviced.currentCondition, serviced.nextServiceDue], ['good', '2027-02-10']);
  assert.deepEqual(
    [serviced.maintenanceLogs[0].serviceType, serviced.maintenanceLogs[0].serviceCost, serviced.maintenanceLogs[0].vendorServiceCenter],
    ['Oil change', '85.00', null],
  );
  const entry = store.auditEntries.at(-1);
  assert.deepEqual([entry.action, entry.before], ['update', { currentCondition: 'needs_maintenance' }]);
  assert.deepEqual(entry.after, {
    currentCondition: 'good',
    service: { serviceDate: '2026-11-10', serviceType: 'Oil change', serviceCost: '85.00', vendorServiceCenter: null, nextServiceDue: '2027-02-10', notes: null },
  });

  assert.equal((await as(request(server).post('/api/assets/4/maintenance').send(service()), tokens.maya).expect(409)).body.code, 'ASSET_DECOMMISSIONED');
  const early = await as(request(server).post('/api/assets/2/maintenance').send(service({ nextServiceDue: '2026-11-10' })), tokens.maya).expect(400);
  assert.equal(early.body.code, 'SERVICE_DUE_BEFORE_SERVICE');
  const invalid = [
    { serviceDate: '' }, { serviceDate: '2026-13-01' }, { serviceType: ' ' }, { serviceCost: '1.234' }, { condition: 'decommissioned' },
    { vendorServiceCenter: 'x'.repeat(129) },
  ];
  for (const values of invalid) {
    await as(request(server).post('/api/assets/2/maintenance').send(service(values)), tokens.maya).expect(400);
  }
});
