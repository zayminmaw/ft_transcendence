const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { recordAudit } = require('../../dist/modules/audit');
const { AuditLog } = require('../../dist/modules/audit/entities/audit-log.entity');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');
const { Client } = require('../../dist/modules/clients/entities/client.entity');
const { LedgerRepository } = require('../../dist/modules/billing/ledger.repository');
const { LedgerService } = require('../../dist/modules/billing/ledger.service');
const { PendingCodService } = require('../../dist/modules/billing/pending-cod.service');
const { CodRepository } = require('../../dist/modules/billing/cod.repository');
const { CodService } = require('../../dist/modules/billing/cod.service');
const { MerchantLedgerEntry } = require('../../dist/modules/billing/entities/merchant-ledger-entry.entity');
const { ParcelsRepository } = require('../../dist/modules/parcels/parcels.repository');
const { ParcelsService } = require('../../dist/modules/parcels/parcels.service');
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

test('tracking finds any company\'s parcel by its number, with only its status and times', async () => {
  const parcel = await sortedParcel();
  const tracked = await parcels.track(parcel.trackingNumber);
  assert.deepEqual(Object.keys(tracked).sort(), ['company', 'events', 'status', 'trackingNumber']);
  assert.deepEqual([tracked.trackingNumber, tracked.status, tracked.company], [parcel.trackingNumber, 'in_hub_sorted', 'Parcels Meridian']);
  assert.deepEqual(tracked.events.map((event) => event.status), ['pickup_scheduled', 'picked_up', 'in_hub_sorted']);
  assert.deepEqual(Object.keys(tracked.events[0]).sort(), ['at', 'status']);
  assert.ok(tracked.events.every((event) => event.at instanceof Date));

  const elsewhere = await newParcel({ clientId: clients.harbor }, harbor);
  assert.equal((await parcels.track(elsewhere.trackingNumber)).company, 'Parcels Harbor');
  assert.equal(await parcels.track('TRC-NOSUCHPARC'), null);
});

test('tracking hides a draft and the parcels of a suspended company', async () => {
  const draft = await newParcel();
  await database.query("UPDATE parcels SET lifecycle_status = 'draft' WHERE id = ?", [draft.id]);
  assert.equal(await parcels.track(draft.trackingNumber), null);

  const closed = (await database.getRepository(Organization).save({
    name: 'Parcels Closed', slug: 'parcels-closed', contactEmail: 'ops@closed.db.test', isActive: false,
  })).id;
  const merchant = await insertClient(closed, 'SHUT', 'Shut Shop', true);
  const hidden = await newParcel({ clientId: merchant }, closed);
  assert.equal(await parcels.track(hidden.trackingNumber), null);
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

test('dispatch shows the COD each driver is expected to bring back, for the parcels out with them now', async () => {
  const everyone = await parcels.dispatchDrivers(meridian);
  const before = everyone.find((driver) => driver.id === drivers.leen);
  const samirBefore = everyone.find((driver) => driver.id === drivers.samir).expectedCod;
  const base = BigInt(before.expectedCod.replace('.', ''));
  const one = await outParcel({ codAmount: '120.00' });
  const two = await outParcel({ codAmount: '80.50' });
  await sortedParcel({ codAmount: '999.00' });
  const find = async (organizationId, id) => (await parcels.dispatchDrivers(organizationId)).find((driver) => driver.id === id);

  const loaded = await find(meridian, drivers.leen);
  assert.equal(BigInt(loaded.expectedCod.replace('.', '')), base + 20050n);
  assert.match(loaded.expectedCod, /^\d+\.\d{2}$/);
  // A parcel still in the hub is not carried, so it adds nothing.
  assert.equal((await find(meridian, drivers.leen)).expectedCod, loaded.expectedCod);
  // Another driver's total does not move.
  assert.equal((await find(meridian, drivers.samir)).expectedCod, samirBefore);
  // Once delivered or failed the parcel is no longer on the road, so it leaves the total.
  await database.query("UPDATE parcels SET lifecycle_status = 'delivered' WHERE id = ?", [one.id]);
  assert.equal(BigInt((await find(meridian, drivers.leen)).expectedCod.replace('.', '')), base + 8050n);
  await database.query("UPDATE parcels SET lifecycle_status = 'failed_attempt' WHERE id = ?", [two.id]);
  assert.equal((await find(meridian, drivers.leen)).expectedCod, before.expectedCod);
});

test('the expected COD never includes another company\'s parcels, even when they name the same driver', async () => {
  const find = async () => (await parcels.dispatchDrivers(meridian)).find((driver) => driver.id === drivers.leen);
  const before = (await find()).expectedCod;
  const foreign = await newParcel({ clientId: clients.harbor, codAmount: '500.00' }, harbor);
  await database.query("UPDATE parcels SET assigned_driver_id = ?, lifecycle_status = 'out_for_delivery' WHERE id = ?", [drivers.leen, foreign.id]);
  assert.equal((await find()).expectedCod, before);
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

// A parcel out with leen, ready to deliver; its cash due is 120.00.
async function outParcel(extra) {
  const parcel = await sortedParcel(extra);
  return (await parcels.assign(meridian, parcel.id, clerk, drivers.leen, null, noAudit)).parcel;
}
async function proofReadyParcel(extra) {
  const parcel = await outParcel(extra);
  await parcels.attachProof(meridian, parcel.id, 'photo', await insertFile(meridian), clerk);
  await parcels.attachProof(meridian, parcel.id, 'signature', await insertFile(meridian, 'signature.png'), clerk);
  return parcel;
}
const deliver = (id, collected = '120.00', actor = clerk, organizationId = meridian, audit = noAudit) =>
  parcels.deliver(organizationId, id, actor, { collected, latitude: null, longitude: null, notes: null }, audit);

test('a delivery needs the exact cash due, marks the parcel delivered with the time, and keeps who took it out', async () => {
  const parcel = await proofReadyParcel();
  assert.deepEqual(parcel.deliveredAt, null);
  // Less, more, or nothing: refused, and the parcel is still out with no step added.
  for (const wrong of ['119.99', '120.01', '0.00']) assert.deepEqual(await deliver(parcel.id, wrong), { status: 'cod_mismatch' });
  const stuck = await parcels.find(meridian, parcel.id);
  assert.deepEqual([stuck.status, stuck.deliveredAt, steps(stuck).at(-1)], ['out_for_delivery', null, 'out_for_delivery']);

  const seen = [];
  const { parcel: done } = await deliver(parcel.id, '120.00', clerk, meridian, async (_manager, before, after) => { seen.push([before.status, after.status]); });
  assert.deepEqual([done.status, done.deliveredAt instanceof Date], ['delivered', true]);
  assert.deepEqual(seen, [['out_for_delivery', 'delivered']]);
  const details = await parcels.find(meridian, parcel.id);
  assert.equal(details.collectedAmount, '120.00');
  const last = details.events.at(-1);
  assert.deepEqual([last.status, last.driver.name, last.vehicle.tag, last.run.id, last.actor.userId], [
    'delivered', 'Leen Mansour', 'V-012', parcel.run.id, String(clerk),
  ]);
  // The parcel stays with its driver, and delivering again is a move from the wrong status.
  assert.equal(details.driver.id, drivers.leen);
  assert.deepEqual(await deliver(parcel.id), { status: 'wrong_status' });
});

test('only a parcel that is out for delivery, in the company, can be delivered', async () => {
  assert.deepEqual(await deliver((await newParcel()).id), { status: 'wrong_status' });
  assert.deepEqual(await deliver((await sortedParcel()).id), { status: 'wrong_status' });
  assert.deepEqual(await deliver('999999'), { status: 'not_found' });
  const parcel = await outParcel();
  assert.deepEqual(await deliver(parcel.id, '120.00', clerk, harbor), { status: 'not_found' });
  assert.equal((await parcels.find(meridian, parcel.id)).status, 'out_for_delivery');
});

test('a driver\'s own account delivers only what is assigned to them; an account that is no driver\'s may deliver any', async () => {
  const leenUser = (await database.getRepository(User).save({ username: 'leen.account', email: 'leen@parcels.db.test', passwordHash: 'x' })).id;
  const samirUser = (await database.getRepository(User).save({ username: 'samir.account', email: 'samir@parcels.db.test', passwordHash: 'x' })).id;
  await database.query('UPDATE employees SET user_id = ? WHERE id = ?', [leenUser, drivers.leen]);
  await database.query('UPDATE employees SET user_id = ? WHERE id = ?', [samirUser, drivers.samir]);
  const parcel = await proofReadyParcel();
  assert.deepEqual(await deliver(parcel.id, '120.00', samirUser), { status: 'not_assigned_driver' });
  assert.equal((await parcels.find(meridian, parcel.id)).status, 'out_for_delivery');
  assert.equal((await deliver(parcel.id, '120.00', leenUser)).status, 'updated');
  // The clerk is no driver, so may deliver any parcel (a dispatcher closing a run).
  assert.equal((await deliver((await proofReadyParcel()).id)).status, 'updated');
});

test('two deliveries at once record one delivery, and a failing audit undoes it', async () => {
  const parcel = await proofReadyParcel();
  const results = await Promise.all([deliver(parcel.id), deliver(parcel.id)]);
  assert.deepEqual(results.map((result) => result.status).sort(), ['updated', 'wrong_status']);
  assert.equal(steps(await parcels.find(meridian, parcel.id)).filter((step) => step === 'delivered').length, 1);

  const other = await proofReadyParcel();
  await assert.rejects(deliver(other.id, '120.00', clerk, meridian, async () => { throw new Error('audit down'); }), /audit down/);
  const after = await parcels.find(meridian, other.id);
  assert.equal(after.collectedAmount, null);
  assert.deepEqual([after.status, after.deliveredAt, steps(after).at(-1)], ['out_for_delivery', null, 'out_for_delivery']);
});

// The service adds the cash recorded as collected to the merchant's pending COD in the delivery's transaction; the
// repository alone doesn't.
const serviceWith = (audit) => new ParcelsService(parcels, audit, new PendingCodService(new LedgerService(new LedgerRepository())));
const actor = () => ({ tenant: { organizationId: meridian }, userId: clerk, meta: {} });
const pending = async (clientId) => (await database.getRepository(Client).findOneByOrFail({ id: clientId })).pendingCodBalance;

test('dispatching and returning never touch the pending COD, only a recorded delivery does', async () => {
  const service = serviceWith({ record: async () => {} });
  const merchant = await insertClient(meridian, 'HOOK1', 'Hook One', true);
  const returned = await sortedParcel({ clientId: merchant, codAmount: '40.00' });
  await service.assign(actor(), returned.id, { driverId: drivers.leen });
  await service.move(actor(), returned.id, { status: 'failed_attempt', reasonCode: 'recipient_unavailable' });
  await service.assign(actor(), returned.id, { driverId: drivers.samir });
  await service.move(actor(), returned.id, { status: 'failed_attempt', reasonCode: 'refused' });
  await service.move(actor(), returned.id, { status: 'returned_to_sender' });
  assert.equal(await pending(merchant), '0.00');

  const parcel = await sortedParcel({ clientId: merchant, codAmount: '120.50' });
  await service.assign(actor(), parcel.id, { driverId: drivers.leen });
  assert.equal(await pending(merchant), '0.00');
  await parcels.attachProof(meridian, parcel.id, 'photo', await insertFile(meridian), clerk);
  await parcels.attachProof(meridian, parcel.id, 'signature', await insertFile(meridian), clerk);
  await service.deliver(actor(), parcel.id, { collectedAmount: '120.5' });
  assert.equal(await pending(merchant), '120.50');
  assert.equal(await database.getRepository(MerchantLedgerEntry).countBy({ clientId: merchant }), 0);
});

test('two delivered parcels of one merchant add up, and a parcel with no cash changes nothing', async () => {
  const service = serviceWith({ record: async () => {} });
  const merchant = await insertClient(meridian, 'HOOK2', 'Hook Two', true);
  for (const codAmount of ['10.00', '0.00', '5.25']) {
    const parcel = await sortedParcel({ clientId: merchant, codAmount });
    await service.assign(actor(), parcel.id, { driverId: drivers.leen });
    await parcels.attachProof(meridian, parcel.id, 'photo', await insertFile(meridian), clerk);
    await parcels.attachProof(meridian, parcel.id, 'signature', await insertFile(meridian), clerk);
    await service.deliver(actor(), parcel.id, { collectedAmount: codAmount });
  }
  assert.equal(await pending(merchant), '15.25');
});

test('a refused delivery or a failed audit leaves the parcel and the pending balance as they were', async () => {
  const merchant = await insertClient(meridian, 'HOOK3', 'Hook Three', true);
  const parcel = await sortedParcel({ clientId: merchant, codAmount: '40.00' });
  await serviceWith({ record: async () => {} }).assign(actor(), parcel.id, { driverId: drivers.leen });
  await parcels.attachProof(meridian, parcel.id, 'photo', await insertFile(meridian), clerk);
  await parcels.attachProof(meridian, parcel.id, 'signature', await insertFile(meridian), clerk);
  await assert.rejects(serviceWith({ record: async () => {} }).deliver(actor(), parcel.id, { collectedAmount: '39.00' }), (error) => error.getStatus() === 409);
  assert.equal(await pending(merchant), '0.00');
  const failing = serviceWith({ record: async () => { throw new Error('audit down'); } });
  await assert.rejects(failing.deliver(actor(), parcel.id, { collectedAmount: '40.00' }), /audit down/);
  assert.equal(await pending(merchant), '0.00');
  assert.equal((await parcels.find(meridian, parcel.id)).status, 'out_for_delivery');
});

// A storage_files row of the company, as StorageService would have saved it.
async function insertFile(organizationId, name = 'door.png') {
  const result = await database.query(
    `INSERT INTO storage_files (organization_id, uploaded_by_user_id, stored_name, original_name, mime_type, size_bytes)
     VALUES (?, ?, UUID(), ?, 'image/png', 16)`,
    [organizationId, clerk, name],
  );
  return String(result.insertId);
}

const proofOf = async (id) => (await parcels.find(meridian, id)).proofFileIds;
const at = { collected: '120.00', latitude: 31.9539494, longitude: 35.910635, notes: 'Handed to the recipient' };

test('proof files attach while out for delivery, one per kind, answering the file each replaces', async () => {
  const parcel = await outParcel();
  const [first, second, note] = [await insertFile(meridian), await insertFile(meridian), await insertFile(meridian, 'note.pdf')];
  assert.deepEqual(await parcels.attachProof(meridian, parcel.id, 'photo', first, clerk), { status: 'updated', previousFileId: null });
  assert.deepEqual(await parcels.attachProof(meridian, parcel.id, 'photo', second, clerk), { status: 'updated', previousFileId: first });
  await parcels.attachProof(meridian, parcel.id, 'note', note, clerk);
  assert.deepEqual(await proofOf(parcel.id), { signature: null, photo: second, note });
  assert.deepEqual(await parcels.attachProof(meridian, parcel.id, 'note', null, clerk), { status: 'updated', previousFileId: note });
  assert.deepEqual(await proofOf(parcel.id), { signature: null, photo: second, note: null });

  // Not out for delivery, or not in this company.
  assert.deepEqual(await parcels.attachProof(meridian, (await sortedParcel()).id, 'photo', first, clerk), { status: 'wrong_status' });
  assert.deepEqual(await parcels.attachProof(harbor, parcel.id, 'photo', first, clerk), { status: 'not_found' });
  assert.equal(await parcels.statusOf(harbor, parcel.id), null);
  assert.equal(await parcels.statusOf(meridian, parcel.id), 'out_for_delivery');

  // Removing the file itself clears the reference.
  await database.query('DELETE FROM storage_files WHERE id = ?', [second]);
  assert.equal((await proofOf(parcel.id)).photo, null);
});

test('a delivery needs the signature and photo, records where and when, and then the proof is fixed', async () => {
  const parcel = await outParcel();
  assert.deepEqual(await parcels.deliver(meridian, parcel.id, clerk, at, noAudit), { status: 'proof_missing' });
  await parcels.attachProof(meridian, parcel.id, 'photo', await insertFile(meridian), clerk);
  assert.deepEqual(await parcels.deliver(meridian, parcel.id, clerk, at, noAudit), { status: 'proof_missing' });
  await parcels.attachProof(meridian, parcel.id, 'signature', await insertFile(meridian, 'signature.png'), clerk);
  assert.deepEqual(await parcels.deliver(harbor, parcel.id, clerk, at, noAudit), { status: 'not_found' });

  let audited;
  const { parcel: delivered } = await parcels.deliver(meridian, parcel.id, clerk, at, async (_manager, before, after) => { audited = [before.status, after.status]; });
  assert.deepEqual(audited, ['out_for_delivery', 'delivered']);
  assert.equal(delivered.status, 'delivered');
  assert.ok(delivered.deliveredAt instanceof Date);
  assert.deepEqual(delivered.deliveryLocation, { latitude: '31.95394940', longitude: '35.91063500' });
  const last = (await parcels.find(meridian, parcel.id)).events.at(-1);
  assert.deepEqual([last.status, last.driver.name, last.vehicle.tag, last.run.id, last.notes], [
    'delivered', 'Leen Mansour', 'V-012', delivered.run.id, 'Handed to the recipient',
  ]);

  assert.deepEqual(await parcels.deliver(meridian, parcel.id, clerk, at, noAudit), { status: 'wrong_status' });
  assert.deepEqual(await parcels.attachProof(meridian, parcel.id, 'photo', null, clerk), { status: 'wrong_status' });
  assert.deepEqual(await parcels.move(meridian, parcel.id, clerk, { status: 'failed_attempt', reasonCode: 'refused' }, noAudit), { status: 'wrong_status' });

  // Without a location the delivery still counts.
  const other = await outParcel();
  await parcels.attachProof(meridian, other.id, 'photo', await insertFile(meridian), clerk);
  await parcels.attachProof(meridian, other.id, 'signature', await insertFile(meridian), clerk);
  const plain = (await parcels.deliver(meridian, other.id, clerk, { collected: '120.00', latitude: null, longitude: null, notes: null }, noAudit)).parcel;
  assert.deepEqual([plain.status, plain.deliveryLocation], ['delivered', null]);
});

test('a failed attempt drops its unconfirmed proof, and a failed audit keeps it', async () => {
  const parcel = await outParcel();
  const [photo, signature] = [await insertFile(meridian), await insertFile(meridian)];
  await parcels.attachProof(meridian, parcel.id, 'photo', photo, clerk);
  await parcels.attachProof(meridian, parcel.id, 'signature', signature, clerk);
  const failing = async () => { throw new Error('audit down'); };
  await assert.rejects(parcels.deliver(meridian, parcel.id, clerk, at, failing), /audit down/);
  await assert.rejects(parcels.move(meridian, parcel.id, clerk, { status: 'failed_attempt', reasonCode: 'refused' }, failing), /audit down/);
  assert.deepEqual(await proofOf(parcel.id), { signature, photo, note: null });

  const result = await parcels.move(meridian, parcel.id, clerk, { status: 'failed_attempt', reasonCode: 'refused' }, noAudit);
  assert.deepEqual(result.discardedFileIds.sort(), [photo, signature].sort());
  assert.deepEqual(await proofOf(parcel.id), { signature: null, photo: null, note: null });
});

test('assigned-only access filters every read and rechecks every proof and delivery write', async () => {
  const owner = (await database.getRepository(User).save({ username: 'pod.owner', email: 'pod.owner@parcels.db.test', passwordHash: 'x' })).id;
  const other = (await database.getRepository(User).save({ username: 'pod.other', email: 'pod.other@parcels.db.test', passwordHash: 'x' })).id;
  await database.query('UPDATE employees SET user_id = ? WHERE id = ?', [owner, drivers.leen]);
  await database.query('UPDATE employees SET user_id = ? WHERE id = ?', [other, drivers.samir]);
  const parcel = await proofReadyParcel();
  const fileId = await insertFile(meridian);
  assert.equal(await parcels.isAssignedTo(meridian, parcel.id, owner), true);
  for (const userId of [other, clerk]) {
    assert.equal(await parcels.isAssignedTo(meridian, parcel.id, userId), false);
    assert.equal(await parcels.find(meridian, parcel.id, userId), null);
    assert.equal(await parcels.statusOf(meridian, parcel.id, userId), null);
    assert.deepEqual(await parcels.attachProof(meridian, parcel.id, 'photo', fileId, userId, true), { status: 'not_found' });
    assert.deepEqual(await parcels.attachProof(meridian, parcel.id, 'photo', null, userId, true), { status: 'not_found' });
    assert.deepEqual(await parcels.deliver(meridian, parcel.id, userId, at, noAudit, true), { status: 'not_found' });
  }
  assert.equal(await parcels.find(harbor, parcel.id, owner), null);
  const ownList = await parcels.list(meridian, query(), owner);
  assert.ok(ownList.items.length > 0);
  assert.ok(ownList.items.every((item) => item.driver.id === drivers.leen));
  const counts = await parcels.counts(meridian, owner);
  assert.equal(Object.values(counts.statuses).reduce((sum, count) => sum + count, 0), ownList.total);
  const previousFileId = (await proofOf(parcel.id)).photo;
  assert.deepEqual(await parcels.attachProof(meridian, parcel.id, 'photo', fileId, owner, true), { status: 'updated', previousFileId });
  assert.equal((await parcels.deliver(meridian, parcel.id, owner, at, noAudit, true)).parcel.collectedAmount, '120.00');
});

test('proof upload, replacement and deletion restrict full-scope linked drivers exactly like delivery', async () => {
  const owner = (await database.getRepository(User).save({ username: 'pod.full.owner', email: 'pod.full.owner@parcels.db.test', passwordHash: 'x' })).id;
  const other = (await database.getRepository(User).save({ username: 'pod.full.other', email: 'pod.full.other@parcels.db.test', passwordHash: 'x' })).id;
  await database.query('UPDATE employees SET user_id = ? WHERE id = ?', [owner, drivers.leen]);
  await database.query('UPDATE employees SET user_id = ? WHERE id = ?', [other, drivers.samir]);
  const parcel = await outParcel();
  for (const kind of ['signature', 'photo', 'note']) {
    const first = await insertFile(meridian);
    const second = await insertFile(meridian);
    assert.deepEqual(await parcels.attachProof(meridian, parcel.id, kind, first, other), { status: 'not_assigned_driver' });
    assert.equal((await proofOf(parcel.id))[kind], null);
    assert.deepEqual(await parcels.attachProof(meridian, parcel.id, kind, first, owner), { status: 'updated', previousFileId: null });
    assert.deepEqual(await parcels.attachProof(meridian, parcel.id, kind, second, other), { status: 'not_assigned_driver' });
    assert.deepEqual(await parcels.attachProof(meridian, parcel.id, kind, null, other), { status: 'not_assigned_driver' });
    assert.equal((await proofOf(parcel.id))[kind], first);
    assert.deepEqual(await parcels.attachProof(meridian, parcel.id, kind, second, owner), { status: 'updated', previousFileId: first });
    assert.deepEqual(await parcels.attachProof(meridian, parcel.id, kind, null, owner), { status: 'updated', previousFileId: second });
  }
});

// Later features add migrations after the cutover. Exercise this named revision without reverting those features.
async function undoPendingCodCutover() {
  const migration = database.migrations.find((item) => item.constructor.name === 'PendingCodAtDelivery1793750400000');
  assert.ok(migration);
  const runner = database.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await migration.down(runner);
    await runner.query('DELETE FROM migrations WHERE name = ?', [migration.constructor.name]);
    await runner.commitTransaction();
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
}

test('the pending COD cutover migrates old holds atomically and handles in-flight deliveries, returns and handovers', async () => {
  await undoPendingCodCutover();
  const merchant = await insertClient(meridian, 'CUTOVER', 'Cutover merchant', true);
  const empty = await insertClient(meridian, 'CUTEMPTY', 'Old phantom balance', false);
  const foreign = await insertClient(harbor, 'CUTOTHER', 'Other company', true);
  const delivered = await proofReadyParcel({ clientId: merchant });
  await deliver(delivered.id);
  // A pre-collected_amount delivery retains an unknown collection fact, but the old hold remains due at handover.
  await database.query('UPDATE parcels SET collected_amount = NULL WHERE id = ?', [delivered.id]);
  const out = await proofReadyParcel({ clientId: merchant, codAmount: '80.00' });
  const failed = await outParcel({ clientId: merchant, codAmount: '30.00' });
  await parcels.move(meridian, failed.id, clerk, { status: 'failed_attempt', reasonCode: 'refused' }, noAudit);
  const settled = await proofReadyParcel({ clientId: merchant, codAmount: '40.00' });
  await deliver(settled.id, '40.00');
  await newParcel({ clientId: merchant, codAmount: '17.00' }); // never dispatched
  await database.query("UPDATE clients SET pending_cod_balance = '270.00' WHERE id = ?", [merchant]);
  await database.query("UPDATE clients SET pending_cod_balance = '99.00' WHERE id = ?", [empty]);
  const foreignParcel = await newParcel({ clientId: foreign, codAmount: '10.00' }, harbor);
  await database.query("UPDATE parcels SET lifecycle_status = 'delivered', delivered_at = NOW() WHERE id = ?", [foreignParcel.id]);
  await database.query("UPDATE clients SET pending_cod_balance = '10.00' WHERE id = ?", [foreign]);
  const cod = new CodService(new CodRepository(database), new LedgerService(new LedgerRepository()), { record: async () => {} });
  const handover = (parcelIds, totalCashDropped, settlementReference) => cod.reconcile(actor(), {
    driverId: drivers.leen, parcelIds, totalCashDropped, settlementReference,
  });
  await handover([settled.id], '40.00', 'CUTOVER-SETTLED');
  assert.equal(await pending(merchant), '230.00');
  const ledgerBefore = await database.getRepository(MerchantLedgerEntry).countBy({ clientId: merchant });

  // Exercise TypeORM's actual per-migration transaction override, including failure after the balance UPDATE.
  const migration = database.migrations.find((item) => item.constructor.name === 'PendingCodAtDelivery1793750400000');
  assert.ok(migration);
  const originalUp = migration.up;
  migration.up = async (runner) => {
    assert.equal(runner.isTransactionActive, true);
    await originalUp.call(migration, runner);
    throw new Error('cutover interrupted');
  };
  await assert.rejects(database.runMigrations(), /cutover interrupted/);
  assert.equal(await pending(merchant), '230.00');
  assert.equal(await pending(empty), '99.00');
  migration.up = originalUp;
  await database.runMigrations();
  assert.equal(await pending(merchant), '120.00');
  assert.equal(await pending(empty), '0.00');
  assert.equal(await pending(foreign), '10.00');
  assert.equal((await parcels.find(meridian, delivered.id)).collectedAmount, null);
  assert.equal(await database.getRepository(MerchantLedgerEntry).countBy({ clientId: merchant }), ledgerBefore);
  assert.equal((await database.getRepository(Client).findOneByOrFail({ id: merchant })).currentBalance, '33.00');

  const service = serviceWith({ record: async () => {} });
  await service.deliver(actor(), out.id, { collectedAmount: '80.00' });
  assert.equal(await pending(merchant), '200.00');
  await service.move(actor(), failed.id, { status: 'returned_to_sender', notes: 'Returned after cutover' });
  assert.equal(await pending(merchant), '200.00');
  await handover([delivered.id, out.id], '200.00', 'CUTOVER-REMAINING');
  assert.equal(await pending(merchant), '0.00');
  const fresh = await sortedParcel({ clientId: merchant, codAmount: '25.00' });
  await service.assign(actor(), fresh.id, { driverId: drivers.leen });
  assert.equal(await pending(merchant), '0.00');

  const originalDown = migration.down;
  migration.down = async (runner) => {
    assert.equal(runner.isTransactionActive, true);
    await originalDown.call(migration, runner);
    throw new Error('rollback interrupted');
  };
  await assert.rejects(database.undoLastMigration({ transaction: 'each' }), /rollback interrupted/);
  assert.equal(await pending(merchant), '0.00');
  migration.down = originalDown;
  await assert.rejects(database.undoLastMigration({ transaction: 'none' }), /--transaction each/);
  await database.undoLastMigration({ transaction: 'each' });
  assert.equal(await pending(merchant), '25.00');
  await database.runMigrations();
  assert.equal(await pending(merchant), '0.00');
});

test('cutover refuses inconsistent imported cash and out-of-range totals without changing balances', async () => {
  await undoPendingCodCutover();
  const bad = await insertClient(meridian, 'CUTBAD', 'Mismatched collection', true);
  const huge = await insertClient(meridian, 'CUTHUGE', 'Excessive total', true);
  const badParcel = await newParcel({ clientId: bad, codAmount: '100.00' });
  await database.query("UPDATE parcels SET lifecycle_status = 'delivered', delivered_at = NOW(), collected_amount = '99.00' WHERE id = ?", [badParcel.id]);
  await database.query("UPDATE clients SET pending_cod_balance = '100.00' WHERE id = ?", [bad]);
  const oversized = [];
  for (let i = 0; i < 2; i++) {
    const parcel = await newParcel({ clientId: huge, codAmount: '9999999999.99' });
    oversized.push(parcel.id);
    await database.query("UPDATE parcels SET lifecycle_status = 'delivered', delivered_at = NOW() WHERE id = ?", [parcel.id]);
  }
  const migrationCount = async () => Number((await database.query("SELECT COUNT(*) AS total FROM migrations WHERE name = 'PendingCodAtDelivery1793750400000'"))[0].total);
  await assert.rejects(database.runMigrations(), /recorded collection differs/);
  assert.deepEqual([await pending(bad), await pending(huge), await migrationCount()], ['100.00', '0.00', 0]);
  // Simulate operator reconciliation of imported records, then retry the same migration.
  await database.query("UPDATE parcels SET collected_amount = '100.00' WHERE id = ?", [badParcel.id]);
  await assert.rejects(database.runMigrations(), /exceeds DECIMAL/);
  assert.deepEqual([await pending(bad), await pending(huge), await migrationCount()], ['100.00', '0.00', 0]);
  await database.query("UPDATE parcels SET lifecycle_status = 'returned_to_sender' WHERE id IN (?)", [oversized]);
  await database.runMigrations();
  assert.deepEqual([await pending(bad), await pending(huge), await migrationCount()], ['100.00', '0.00', 1]);
});
