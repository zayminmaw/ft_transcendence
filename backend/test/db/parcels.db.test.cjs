const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { recordAudit } = require('../../dist/modules/audit');
const { AuditLog } = require('../../dist/modules/audit/entities/audit-log.entity');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');
const { ParcelsRepository } = require('../../dist/modules/parcels/parcels.repository');
const { User } = require('../../dist/modules/users/entities/user.entity');

let database;
let parcels;
let meridian;
let harbor;
let clerk;
let sorter;
const clients = {};
const drivers = {};
before(async () => {
  database = await createTestDatabase();
  parcels = new ParcelsRepository(database);
  const organizations = database.getRepository(Organization);
  meridian = (await organizations.save({ name: 'Parcels Meridian', slug: 'parcels-meridian', contactEmail: 'ops@meridian.db.test' })).id;
  harbor = (await organizations.save({ name: 'Parcels Harbor', slug: 'parcels-harbor', contactEmail: 'ops@harbor.db.test' })).id;
  clerk = (await database.getRepository(User).save({ username: 'clerk', email: 'clerk@parcels.db.test', passwordHash: 'x', displayName: 'Rami Saleh' })).id;
  sorter = (await database.getRepository(User).save({ username: 'sorter', email: 'sorter@parcels.db.test', passwordHash: 'x' })).id;

  for (const [key, organizationId, name, isActive = true] of [
    ['paper', meridian, 'Paper & Co.'], ['field', meridian, 'Field Goods'], ['closed', meridian, 'Closed Shop', false],
    ['harbor', harbor, 'Harbor Mart'],
  ]) clients[key] = await insertClient(organizationId, key.toUpperCase(), name, isActive);

  // leen has a van checked out (and a scanner, which isn't a vehicle); samir rides his own motorcycle; hadi is off duty;
  // gone was terminated; tariq drives for Harbor.
  for (const [key, organizationId, lastName, status, employment = 'active'] of [
    ['leen', meridian, 'Mansour', 'available'], ['samir', meridian, 'Farah', 'out_for_delivery'], ['hadi', meridian, 'Salim', 'off_duty'],
    ['gone', meridian, 'Away', 'available', 'terminated'], ['tariq', harbor, 'Aziz', 'available'],
  ]) drivers[key] = await insertDriver(organizationId, key, lastName, status, employment);
  const van = await insertAsset(meridian, 'V-012', 'Van', 'van');
  const scanner = await insertAsset(meridian, 'SC-1', 'Scanner', 'barcode_scanner');
  const oldVan = await insertAsset(meridian, 'V-001', 'Old van', 'van');
  await database.query('INSERT INTO asset_assignments (asset_id, driver_id, checked_out_at, checked_in_at) VALUES (?, ?, ?, ?)',
    [oldVan, drivers.leen, '2026-01-01 08:00:00', '2026-01-01 18:00:00']);
  for (const asset of [van, scanner]) {
    await database.query('INSERT INTO asset_assignments (asset_id, driver_id) VALUES (?, ?)', [asset, drivers.leen]);
  }
  drivers.van = van;
});
after(() => database?.destroy());

async function insertClient(organizationId, code, name, isActive) {
  const result = await database.query(
    `INSERT INTO clients (organization_id, client_code, business_name, contact_person_name, mobile_1, email, billing_address,
                          default_pickup_address, is_active)
     VALUES (?, ?, ?, 'Contact', '+962 7 9000 0000', ?, 'Billing', 'Pickup', ?)`,
    [organizationId, code, name, `${code.toLowerCase()}@parcels.db.test`, isActive],
  );
  return String(result.insertId);
}

// delivery_drivers gains organization_id with the drivers module (DriverCompanyKeys); filled when the column exists.
async function insertDriver(organizationId, key, lastName, dispatchStatus, employmentStatus) {
  const employee = await database.query(
    `INSERT INTO employees (organization_id, employee_code, first_name, last_name, department, personnel_type,
                            employment_classification, compensation_type, national_id, date_of_birth, personal_mobile,
                            personal_email, residential_address, emergency_contact_name, emergency_contact_phone,
                            employment_status, hire_date)
     VALUES (?, ?, ?, ?, 'field_logistics', 'driver', 'full_time', 'hybrid', 'NID', '1990-01-01', '+962 7 9000 0000', ?,
             'Home', 'Contact', '+962 7 9000 0001', ?, '2025-01-01')`,
    [organizationId, `DRV-${key.toUpperCase()}`, key[0].toUpperCase() + key.slice(1), lastName, `${key}@parcels.db.test`, employmentStatus],
  );
  const id = String(employee.insertId);
  const [column] = await database.query("SHOW COLUMNS FROM delivery_drivers LIKE 'organization_id'");
  await database.query(
    `INSERT INTO delivery_drivers (employee_id, ${column ? 'organization_id, ' : ''}driver_category, fleet_arrangement, license_number,
                                   license_class, license_expiry_date, assigned_zone, dispatch_status)
     VALUES (?, ${column ? '?, ' : ''}'van', 'company_vehicle', ?, 'C', '2030-01-01', 'East', ?)`,
    [id, ...(column ? [organizationId] : []), `LIC-${key}`, dispatchStatus],
  );
  return id;
}

async function insertAsset(organizationId, tag, name, category) {
  const result = await database.query(
    'INSERT INTO assets (organization_id, asset_tag, asset_name, category, license_plate) VALUES (?, ?, ?, ?, ?)',
    [organizationId, tag, name, category, category === 'van' ? `PL-${tag}` : null],
  );
  return String(result.insertId);
}

const noAudit = async () => {};
const query = (extra = {}) => ({ queue: 'all', sort: 'createdAt', direction: 'desc', page: 1, pageSize: 50, ...extra });
const values = (extra = {}) => ({
  clientId: clients.paper, recipientName: 'Maya N.', recipientPhone: '+962 7 9555 0101', recipientSecondaryPhone: null,
  deliveryAddress: '22 Rainbow Street', deliveryCityZone: 'Central', deliveryLandmark: null, weightKg: '1.20', isFragile: false,
  deliveryFee: '7.00', codAmount: '120.00', ...extra,
});

async function newParcel(extra, organizationId = meridian) {
  const result = await parcels.create(organizationId, clerk, values(extra), null, noAudit);
  assert.equal(result.status, 'created');
  return result.parcel;
}

// Moves a new parcel up to the hub, ready for a driver.
async function sortedParcel(extra) {
  const parcel = await newParcel(extra);
  await parcels.move(meridian, parcel.id, sorter, { status: 'picked_up' }, noAudit);
  return (await parcels.move(meridian, parcel.id, sorter, { status: 'in_hub_sorted', hubLocation: 'Central hub' }, noAudit)).parcel;
}

const steps = (details) => details.events.map((event) => event.status);

test('a new parcel gets a waybill number and a scheduled pickup, only for an active merchant of the company', async () => {
  const created = await parcels.create(meridian, clerk, values({ isFragile: true }), 'Call before', noAudit);
  const { parcel } = created;
  assert.match(parcel.trackingNumber, /^TRC-[2-9A-HJKMNP-TV-Z]{10}$/);
  assert.deepEqual(
    [parcel.status, parcel.client, parcel.driver, parcel.run, parcel.isFragile, parcel.weightKg, parcel.deliveryAttemptCount],
    ['pickup_scheduled', { id: clients.paper, code: 'PAPER', name: 'Paper & Co.' }, null, null, true, '1.20', 0],
  );
  const details = await parcels.find(meridian, parcel.id);
  assert.deepEqual(details.events.map(({ status, actor, notes }) => [status, actor, notes]), [
    ['pickup_scheduled', { userId: clerk, name: 'Rami Saleh' }, 'Call before'],
  ]);

  for (const clientId of [clients.closed, clients.harbor, '999999']) {
    assert.deepEqual(await parcels.create(meridian, clerk, values({ clientId }), null, noAudit), { status: 'client_unavailable' });
  }
  // Another company's parcel isn't there.
  assert.equal(await parcels.find(harbor, parcel.id), null);
  assert.deepEqual(await parcels.move(harbor, parcel.id, clerk, { status: 'picked_up' }, noAudit), { status: 'not_found' });
});

test('each status moves only from the one before it, and the history keeps every step', async () => {
  const parcel = await newParcel();
  const move = (status, extra = {}) => parcels.move(meridian, parcel.id, sorter, { status, ...extra }, noAudit);
  assert.deepEqual(await move('in_hub_sorted', { hubLocation: 'Bay 1' }), { status: 'wrong_status' });
  assert.deepEqual(await move('failed_attempt', { reasonCode: 'refused' }), { status: 'wrong_status' });
  assert.equal((await move('picked_up', { notes: 'Two boxes' })).parcel.status, 'picked_up');
  assert.deepEqual(await move('picked_up'), { status: 'wrong_status' });
  assert.equal((await move('in_hub_sorted', { hubLocation: 'Central hub · Bay 3' })).parcel.status, 'in_hub_sorted');
  // A sorted parcel goes out only through an assignment.
  assert.deepEqual(await move('returned_to_sender', { notes: 'No' }), { status: 'wrong_status' });

  const details = await parcels.find(meridian, parcel.id);
  assert.deepEqual(details.events.map(({ status, hubLocation, notes, actor }) => [status, hubLocation, notes, actor?.name]), [
    ['pickup_scheduled', null, null, 'Rami Saleh'],
    ['picked_up', null, 'Two boxes', 'sorter'],
    ['in_hub_sorted', 'Central hub · Bay 3', null, 'sorter'],
  ]);
});

test('an assignment sends the parcel out with an on-duty driver, their vehicle and their run for today', async () => {
  const parcel = await sortedParcel();
  const assign = (driverId, id = parcel.id) => parcels.assign(meridian, id, clerk, driverId, null, noAudit);
  for (const driver of [drivers.hadi, drivers.gone, drivers.tariq, '999999']) {
    assert.deepEqual(await assign(driver), { status: 'driver_unavailable' });
  }
  assert.deepEqual(await parcels.assign(meridian, (await newParcel()).id, clerk, drivers.leen, null, noAudit), { status: 'wrong_status' });

  const { parcel: out } = await parcels.assign(meridian, parcel.id, clerk, drivers.leen, 'Fragile on top', noAudit);
  assert.equal(out.status, 'out_for_delivery');
  assert.deepEqual(out.driver, { id: drivers.leen, name: 'Leen Mansour', employeeCode: 'DRV-LEEN' });
  // The van checked out now: not the scanner, not the van checked back in.
  assert.deepEqual(out.vehicle, { id: drivers.van, tag: 'V-012', name: 'Van', licensePlate: 'PL-V-012' });
  const today = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  assert.equal(out.run.code, `RUN-${today}-${out.run.id}`);
  assert.deepEqual(await assign(drivers.samir), { status: 'wrong_status' });

  // The second parcel of the day joins the same run; samir has no vehicle checked out.
  const second = (await assign(drivers.leen, (await sortedParcel()).id)).parcel;
  assert.equal(second.run.id, out.run.id);
  const third = (await assign(drivers.samir, (await sortedParcel()).id)).parcel;
  assert.deepEqual([third.vehicle, third.run.id === out.run.id], [null, false]);

  const details = await parcels.find(meridian, parcel.id);
  const last = details.events.at(-1);
  assert.deepEqual([last.status, last.driver.name, last.vehicle.tag, last.run.id, last.notes], [
    'out_for_delivery', 'Leen Mansour', 'V-012', out.run.id, 'Fragile on top',
  ]);
});

test('two assignments at once: one parcel goes out once, and one driver gets one run', async () => {
  const hala = await insertDriver(meridian, 'hala', 'Haddad', 'available', 'active');
  const contested = await sortedParcel();
  const raced = await Promise.all([drivers.leen, hala].map((driver) => parcels.assign(meridian, contested.id, clerk, driver, null, noAudit)));
  assert.deepEqual(raced.map((result) => result.status).sort(), ['updated', 'wrong_status']);
  assert.equal(steps(await parcels.find(meridian, contested.id)).filter((status) => status === 'out_for_delivery').length, 1);

  const pair = await Promise.all([sortedParcel(), sortedParcel()]);
  const outs = await Promise.all(pair.map((parcel) => parcels.assign(meridian, parcel.id, clerk, hala, null, noAudit)));
  const runIds = new Set(outs.map((result) => result.parcel.run.id));
  // hala may already have a run from the contested parcel; either way, one run for the day.
  assert.equal(runIds.size, 1);
  const [{ total }] = await database.query('SELECT COUNT(*) AS total FROM dispatch_runs WHERE driver_id = ?', [hala]);
  assert.equal(Number(total), 1);
});

test('a failed attempt counts, keeps its reason and driver, and goes out again or back to the merchant', async () => {
  const parcel = await sortedParcel();
  await parcels.assign(meridian, parcel.id, clerk, drivers.leen, null, noAudit);
  const failed = (await parcels.move(meridian, parcel.id, clerk, { status: 'failed_attempt', reasonCode: 'recipient_unavailable' }, noAudit)).parcel;
  assert.deepEqual([failed.status, failed.deliveryAttemptCount, failed.failedReasonCode, failed.driver.id], [
    'failed_attempt', 1, 'recipient_unavailable', drivers.leen,
  ]);
  const reattempt = (await parcels.assign(meridian, parcel.id, clerk, drivers.samir, null, noAudit)).parcel;
  assert.deepEqual([reattempt.status, reattempt.driver.id, reattempt.vehicle], ['out_for_delivery', drivers.samir, null]);
  await parcels.move(meridian, parcel.id, clerk, { status: 'failed_attempt', reasonCode: 'address_not_found' }, noAudit);
  const returned = (await parcels.move(meridian, parcel.id, clerk, { status: 'returned_to_sender', notes: 'Address not found twice' }, noAudit)).parcel;
  assert.deepEqual([returned.status, returned.deliveryAttemptCount, returned.failedReasonCode], ['returned_to_sender', 2, 'address_not_found']);

  const details = await parcels.find(meridian, parcel.id);
  assert.deepEqual(details.events.slice(3).map(({ status, driver, reasonCode, notes }) => [status, driver?.name ?? null, reasonCode, notes]), [
    ['out_for_delivery', 'Leen Mansour', null, null],
    ['failed_attempt', 'Leen Mansour', 'recipient_unavailable', null],
    ['out_for_delivery', 'Samir Farah', null, null],
    ['failed_attempt', 'Samir Farah', 'address_not_found', null],
    ['returned_to_sender', null, null, 'Address not found twice'],
  ]);
});

test('the list searches, filters by queue or status, sorts and pages within one company; the counts cover the company', async () => {
  await newParcel({ recipientName: 'Omar 100% T.', clientId: clients.field }, meridian);
  await newParcel({ recipientName: 'Harbor only', clientId: clients.harbor }, harbor);
  const list = async (extra) => (await parcels.list(meridian, query(extra))).items;

  const all = await parcels.list(meridian, query());
  const counts = await parcels.counts(meridian);
  assert.equal(all.total, Object.values(counts.statuses).reduce((sum, count) => sum + count, 0));
  assert.ok(all.items.every((parcel) => parcel.recipientName !== 'Harbor only'));
  assert.deepEqual((await list({ search: '100%' })).map((parcel) => parcel.recipientName), ['Omar 100% T.']);
  assert.deepEqual(await list({ search: '_' }), []);
  assert.ok((await list({ search: 'field goods' })).every((parcel) => parcel.client.name === 'Field Goods'));
  const tracking = all.items[3].trackingNumber;
  assert.deepEqual((await list({ search: tracking.toLowerCase() })).map((parcel) => parcel.trackingNumber), [tracking]);

  const statusesOf = async (queue) => new Set((await list({ queue })).map((parcel) => parcel.status));
  assert.deepEqual(await statusesOf('ready'), new Set(['in_hub_sorted']));
  assert.deepEqual(await statusesOf('exceptions'), new Set(['returned_to_sender']));
  assert.deepEqual(await statusesOf('assignable'), new Set(['in_hub_sorted']));
  assert.equal((await list({ queue: 'out_for_delivery' })).length, counts.statuses.out_for_delivery);
  assert.equal(counts.driversOut, 3);

  const merchants = (await list({ sort: 'merchant', direction: 'asc' })).map((parcel) => parcel.client.name);
  assert.deepEqual(merchants, [...merchants].sort((a, b) => a.localeCompare(b)));
  const pages = await Promise.all([1, 2].map((page) => parcels.list(meridian, query({ pageSize: 10, page }))));
  const ids = pages.flatMap((page) => page.items.map((parcel) => parcel.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('the form offers active merchants and known zones; dispatch offers on-duty drivers with their vehicle and run', async () => {
  const options = await parcels.formOptions(meridian);
  assert.deepEqual(options.clients.map((client) => client.name), ['Field Goods', 'Paper & Co.']);
  assert.deepEqual(options.zones, ['Central', 'East']);

  const onDuty = await parcels.dispatchDrivers(meridian);
  // By last name; hadi is off duty and gone was terminated.
  assert.deepEqual(onDuty.map((driver) => driver.name), ['Samir Farah', 'Hala Haddad', 'Leen Mansour']);
  const leen = onDuty.find((driver) => driver.id === drivers.leen);
  assert.equal(leen.vehicle.tag, 'V-012');
  const [{ out }] = await database.query(
    "SELECT COUNT(*) AS `out` FROM parcels WHERE assigned_driver_id = ? AND lifecycle_status = 'out_for_delivery'", [drivers.leen],
  );
  assert.equal(leen.run.parcelsOut, Number(out));
  assert.deepEqual((await parcels.dispatchDrivers(harbor)).map((driver) => driver.name), ['Tariq Aziz']);
});

test('the audit row is written in the change and a failed audit undoes the change', async () => {
  const parcel = await sortedParcel();
  await parcels.assign(meridian, parcel.id, clerk, drivers.leen, null, async (manager, old, saved) => {
    await recordAudit(manager, {
      module: 'parcels', action: 'assign', resourceType: 'parcel', recordId: saved.id, organizationId: meridian,
      before: { status: old.status, driverId: null }, after: { status: saved.status, driverId: saved.driver.id },
    });
  });
  assert.equal(await database.getRepository(AuditLog).countBy({ resourceType: 'parcel', recordId: parcel.id }), 1);

  const failing = async () => { throw new Error('audit down'); };
  await assert.rejects(parcels.move(meridian, parcel.id, clerk, { status: 'failed_attempt', reasonCode: 'refused' }, failing), /audit down/);
  const kept = await parcels.find(meridian, parcel.id);
  assert.deepEqual([kept.status, kept.deliveryAttemptCount, kept.events.length], ['out_for_delivery', 0, 4]);
  const before = (await parcels.list(meridian, query())).total;
  await assert.rejects(parcels.create(meridian, clerk, values(), null, failing), /audit down/);
  assert.equal((await parcels.list(meridian, query())).total, before);
});
