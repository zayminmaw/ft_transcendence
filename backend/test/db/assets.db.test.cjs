const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { AssetsRepository } = require('../../dist/modules/assets/assets.repository');
const { AssetAssignment } = require('../../dist/modules/assets/entities/asset-assignment.entity');
const { insertDriver } = require('../../dist/modules/drivers/drivers.repository');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');

let database;
let assets;
let meridian;
let harbor;
const drivers = {};
const day = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const driverValues = (code, firstName, lastName, extra = {}) => ({
  employeeCode: code, firstName, lastName, personalMobile: '+962 7 9000 0000', personalEmail: `${code.toLowerCase()}@assets.db.test`,
  nationalId: `NID-${code}`, dateOfBirth: '1990-05-01', residentialAddress: 'Home street', emergencyContactName: 'Contact',
  emergencyContactPhone: '+962 7 9000 0001', employmentClassification: 'full_time', compensationType: 'hybrid', employmentStatus: 'active',
  hireDate: '2025-01-01', terminationDate: null, baseSalary: '0.00', bankName: null, bankAccountIban: null, driverCategory: 'van',
  fleetArrangement: 'company_vehicle', assignedZone: null, maxWeightCapacityKg: '0.00', maxVolumeCapacityM3: '0.00',
  commissionPerDrop: '0.00', licenseNumber: `LIC-${code}`, licenseClass: 'C', licenseExpiryDate: '2030-01-01', backgroundCheckPassed: false,
  backgroundCheckDate: null, transitInsurancePolicy: null, transitInsuranceExpiry: null, ...extra,
});

before(async () => {
  database = await createTestDatabase();
  assets = new AssetsRepository(database);
  const organizations = database.getRepository(Organization);
  meridian = (await organizations.save({ name: 'Assets Meridian', slug: 'assets-meridian', contactEmail: 'ops@meridian.db.test' })).id;
  harbor = (await organizations.save({ name: 'Assets Harbor', slug: 'assets-harbor', contactEmail: 'ops@harbor.db.test' })).id;
  await database.transaction(async (manager) => {
    drivers.leen = await insertDriver(manager, meridian, driverValues('AS-001', 'Leen', 'Mansour'));
    drivers.hadi = await insertDriver(manager, meridian, driverValues('AS-002', 'Hadi', 'Salim'));
    drivers.gone = await insertDriver(
      manager, meridian, driverValues('AS-003', 'Gone', 'Away', { employmentStatus: 'terminated', terminationDate: '2026-01-01' }),
    );
    drivers.tariq = await insertDriver(manager, harbor, driverValues('AS-001', 'Tariq', 'Aziz'));
  });
});
after(() => database?.destroy());

const values = (tag, name, extra = {}) => ({
  assetTag: tag, assetName: name, category: 'van', acquisitionCost: '24500.00', currentBookValue: '19600.00', licensePlate: null, vin: null,
  insurancePolicyNumber: null, roadTaxExpiry: null, currentCondition: 'good', notes: null, ...extra,
});
const noAudit = async () => {};
const query = (extra = {}) => ({ status: 'all', sort: 'assetTag', direction: 'asc', page: 1, pageSize: 10, ...extra });
const byTag = async (organizationId, tag) => (await assets.list(organizationId, query({ search: tag }))).items.find((asset) => asset.assetTag === tag);

async function create(organizationId, tag, name, extra) {
  const result = await assets.create(organizationId, values(tag, name, extra), noAudit);
  assert.equal(result.status, 'created');
  return result.asset;
}

test('a new asset: its values, nobody holding it, no history; the tag is unique per company', async () => {
  const van = await create(meridian, 'AST-001', 'Toyota Hiace', { licensePlate: '21-48812', roadTaxExpiry: day(10) });
  assert.deepEqual(
    [van.assetTag, van.acquisitionCost, van.roadTaxExpiry, van.holder, van.nextServiceDue, van.assignments, van.maintenanceLogs],
    ['AST-001', '24500.00', day(10), null, null, [], []],
  );
  assert.ok(van.createdAt instanceof Date);
  assert.deepEqual(await assets.create(meridian, values('AST-001', 'Again'), noAudit), { status: 'tag_taken' });
  // Another company may use the same tag.
  await create(harbor, 'AST-001', 'Harbor van');
});

test('check-out: one driver at a time, only a working driver of the company, also under a race', async () => {
  const van = await byTag(meridian, 'AST-001');
  assert.deepEqual(await assets.checkOut(meridian, van.id, { driverId: drivers.tariq, notes: null }, noAudit), { status: 'driver_unavailable' });
  assert.deepEqual(await assets.checkOut(meridian, van.id, { driverId: drivers.gone, notes: null }, noAudit), { status: 'driver_unavailable' });
  assert.deepEqual(await assets.checkOut(meridian, van.id, { driverId: '999999', notes: null }, noAudit), { status: 'driver_unavailable' });

  const raced = await Promise.all([drivers.leen, drivers.hadi].map((driverId) => assets.checkOut(meridian, van.id, { driverId, notes: 'Fuel full' }, noAudit)));
  assert.deepEqual(raced.map((result) => result.status).sort(), ['already_checked_out', 'updated']);
  assert.equal(await database.getRepository(AssetAssignment).countBy({ assetId: van.id, checkedInAt: null }), 1);
  const { asset } = raced.find((result) => result.status === 'updated');
  assert.ok(['Leen Mansour', 'Hadi Salim'].includes(asset.holder.driverName));
  assert.equal(asset.holder.checkoutNotes, 'Fuel full');
  assert.ok(asset.holder.checkedOutAt instanceof Date);
  assert.equal(asset.assignments.length, 1);
  assert.equal(asset.assignments[0].checkedInAt, null);

  // Nobody else's company: Harbor can't check Meridian's van out, or see it.
  assert.deepEqual(await assets.checkOut(harbor, van.id, { driverId: drivers.tariq, notes: null }, noAudit), { status: 'not_found' });
  assert.equal(await assets.find(harbor, van.id), null);
});

test('a checked-out asset is not decommissioned; check-in closes the check-out with the condition it came back in', async () => {
  const van = await byTag(meridian, 'AST-001');
  assert.deepEqual(await assets.update(meridian, van.id, { currentCondition: 'decommissioned' }, noAudit), { status: 'checked_out' });
  const back = await assets.checkIn(meridian, van.id, { condition: 'needs_maintenance', notes: 'Brakes squeal' }, noAudit);
  assert.equal(back.status, 'updated');
  assert.deepEqual([back.asset.holder, back.asset.currentCondition], [null, 'needs_maintenance']);
  assert.equal(back.asset.assignments[0].checkinNotes, 'Brakes squeal');
  assert.ok(back.asset.assignments[0].checkedInAt instanceof Date);
  assert.deepEqual(await assets.checkIn(meridian, van.id, { condition: 'good', notes: null }, noAudit), { status: 'not_checked_out' });

  const retired = await assets.update(meridian, van.id, { currentCondition: 'decommissioned' }, noAudit);
  assert.equal(retired.asset.currentCondition, 'decommissioned');
  assert.deepEqual(await assets.checkOut(meridian, van.id, { driverId: drivers.leen, notes: null }, noAudit), { status: 'decommissioned' });
  assert.deepEqual(await assets.logMaintenance(meridian, van.id, {
    serviceDate: day(0), serviceType: 'Brakes', serviceCost: '0.00', vendorServiceCenter: null, nextServiceDue: null, notes: null, condition: 'good',
  }, noAudit), { status: 'decommissioned' });
  await assets.update(meridian, van.id, { currentCondition: 'needs_maintenance' }, noAudit);
});

test('services are listed by service date; the next service due comes from the latest that set one', async () => {
  const van = await byTag(meridian, 'AST-001');
  const service = (serviceDate, nextServiceDue, condition = 'good') => assets.logMaintenance(meridian, van.id, {
    serviceDate, serviceType: `Service ${serviceDate}`, serviceCost: '85.00', vendorServiceCenter: 'Al Wehdat', nextServiceDue, notes: null, condition,
  }, noAudit);
  const audited = [];
  const first = await assets.logMaintenance(meridian, van.id, {
    serviceDate: '2026-09-14', serviceType: 'Oil change', serviceCost: '85.00', vendorServiceCenter: null, nextServiceDue: '2026-12-14', notes: null,
    condition: 'good',
  }, async (_manager, old, saved) => audited.push([old.currentCondition, saved.currentCondition, saved.maintenanceLogs[0].serviceType]));
  assert.deepEqual(audited, [['needs_maintenance', 'good', 'Oil change']]);
  assert.equal(first.asset.nextServiceDue, '2026-12-14');
  // An older service doesn't move it; a newer one without a due date doesn't either.
  await service('2026-06-02', '2026-10-25');
  const latest = await service('2026-10-01', null, 'needs_maintenance');
  assert.deepEqual(latest.asset.maintenanceLogs.map((log) => log.serviceDate), ['2026-10-01', '2026-09-14', '2026-06-02']);
  assert.deepEqual([latest.asset.nextServiceDue, latest.asset.currentCondition], ['2026-12-14', 'needs_maintenance']);
  assert.equal((await byTag(meridian, 'AST-001')).nextServiceDue, '2026-12-14');
});

test('the list searches, filters, sorts and pages within one company; the counts', async () => {
  const bag = await create(meridian, 'AST-002', 'Thermal bag 100%', { category: 'thermal_bag' });
  await create(meridian, 'AST-003', 'Honda Wave', { category: 'motorcycle', currentCondition: 'new', roadTaxExpiry: day(-3) });
  await create(meridian, 'AST-004', 'Old Honda', { category: 'motorcycle', currentCondition: 'decommissioned', roadTaxExpiry: day(-100) });
  await assets.checkOut(meridian, bag.id, { driverId: drivers.leen, notes: null }, noAudit);

  const tags = async (extra) => (await assets.list(meridian, query(extra))).items.map((asset) => asset.assetTag);
  assert.deepEqual(await tags({}), ['AST-001', 'AST-002', 'AST-003', 'AST-004']);
  assert.deepEqual(await tags({ status: 'available' }), ['AST-003']);
  assert.deepEqual(await tags({ status: 'checked_out' }), ['AST-002']);
  assert.deepEqual(await tags({ status: 'needs_maintenance' }), ['AST-001']);
  assert.deepEqual(await tags({ status: 'decommissioned' }), ['AST-004']);
  assert.deepEqual(await tags({ sort: 'assetName', direction: 'desc' }), ['AST-001', 'AST-002', 'AST-004', 'AST-003']);
  assert.deepEqual(await tags({ search: 'leen mansour' }), ['AST-002']);
  assert.deepEqual(await tags({ search: 'honda' }), ['AST-003', 'AST-004']);
  // A wildcard typed in the search is a plain character.
  assert.deepEqual(await tags({ search: '100%' }), ['AST-002']);
  assert.deepEqual(await tags({ search: '_' }), []);
  const pages = await Promise.all([1, 2].map((page) => assets.list(meridian, query({ pageSize: 10, page }))));
  assert.deepEqual(pages.map(({ items, total }) => [items.length, total]), [[4, 4], [0, 4]]);
  const listed = (await assets.list(meridian, query({ search: 'AST-002' }))).items[0];
  assert.equal(listed.holder.driverName, 'Leen Mansour');
  assert.equal('assignments' in listed, false);

  // AST-001's road tax (10 days) and AST-003's (expired) are due; the decommissioned one doesn't count.
  assert.deepEqual(await assets.counts(meridian), { inService: 3, checkedOut: 1, needsMaintenance: 1, decommissioned: 1, roadTaxDue: 2 });
  assert.deepEqual(await assets.counts(harbor), { inService: 1, checkedOut: 0, needsMaintenance: 0, decommissioned: 0, roadTaxDue: 0 });
});

test('edits save only what changed, keep the tag unique, and roll back with a failed audit', async () => {
  const motorcycle = await byTag(meridian, 'AST-003');
  assert.equal((await assets.update(meridian, motorcycle.id, { assetName: 'Honda Wave', acquisitionCost: '24500.00' }, noAudit)).status, 'unchanged');
  assert.deepEqual(await assets.update(meridian, motorcycle.id, { assetTag: 'AST-002' }, noAudit), { status: 'tag_taken' });
  const harborVan = await byTag(harbor, 'AST-001');
  assert.deepEqual(await assets.update(meridian, harborVan.id, { assetName: 'Taken over' }, noAudit), { status: 'not_found' });

  const failing = async () => {
    throw new Error('audit failed');
  };
  await assert.rejects(assets.update(meridian, motorcycle.id, { assetName: 'Lost edit' }, failing));
  await assert.rejects(assets.checkOut(meridian, motorcycle.id, { driverId: drivers.hadi, notes: null }, failing));
  const unchanged = await assets.find(meridian, motorcycle.id);
  assert.deepEqual([unchanged.assetName, unchanged.holder, unchanged.assignments], ['Honda Wave', null, []]);
});
