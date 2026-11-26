const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { AuditLog, AuditService } = require('../../dist/modules/audit');
const { CodRepository } = require('../../dist/modules/billing/cod.repository');
const { CodService } = require('../../dist/modules/billing/cod.service');
const { LedgerRepository } = require('../../dist/modules/billing/ledger.repository');
const { LedgerService } = require('../../dist/modules/billing/ledger.service');
const { MerchantLedgerEntry } = require('../../dist/modules/billing/entities/merchant-ledger-entry.entity');
const { DriverCodCollection } = require('../../dist/modules/billing/entities/driver-cod-collection.entity');
const { DriverCodSettlement } = require('../../dist/modules/billing/entities/driver-cod-settlement.entity');
const { ClientsRepository } = require('../../dist/modules/clients/clients.repository');
const { Client } = require('../../dist/modules/clients/entities/client.entity');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');
const { User } = require('../../dist/modules/users/entities/user.entity');

let database;
let service;
let meridian;
let harbor;
let cashier;
before(async () => {
  database = await createTestDatabase();
  service = new CodService(new CodRepository(database), new LedgerService(new LedgerRepository()), new AuditService(database.getRepository(AuditLog)));
  const organizations = database.getRepository(Organization);
  meridian = (await organizations.save({ name: 'Cod Meridian', slug: 'cod-meridian', contactEmail: 'ops@meridian.cod.test' })).id;
  harbor = (await organizations.save({ name: 'Cod Harbor', slug: 'cod-harbor', contactEmail: 'ops@harbor.cod.test' })).id;
  cashier = String((await database.getRepository(User).save({ username: 'cashier.cod', email: 'cashier@cod.test', passwordHash: 'placeholder-hash' })).id);
});
after(() => database?.destroy());

const actor = (organizationId) => ({ tenant: { organizationId, roleId: '1' }, userId: cashier, meta: { ip: '127.0.0.1', userAgent: 'test' } });
let counter = 0;
const next = () => (counter += 1);

async function merchant(organizationId, pending = '0.00') {
  const n = next();
  const result = await new ClientsRepository(database).create(organizationId, {
    clientCode: `CD-${n}`, businessName: `Cod merchant ${n}`, tradeLicenseNo: null, contactPersonName: 'Contact', contactTitle: null,
    mobile1: '+962 7 9000 0000', mobile2: null, email: `cd${n}@cod.test`, billingAddress: 'Billing street',
    defaultPickupAddress: 'Pickup street', pickupLatitude: null, pickupLongitude: null, rateProfileTier: 'standard', operationalNotes: null,
  }, async () => {});
  await database.query('UPDATE clients SET pending_cod_balance = ? WHERE id = ?', [pending, result.client.id]);
  return result.client.id;
}

async function driver(organizationId) {
  const n = next();
  const { insertId } = await database.query(
    `INSERT INTO employees (organization_id, employee_code, first_name, last_name, department, personnel_type, employment_classification,
       compensation_type, national_id, date_of_birth, personal_mobile, personal_email, residential_address, emergency_contact_name,
       emergency_contact_phone, hire_date)
     VALUES (?, ?, 'Drv', ?, 'field_logistics', 'driver', 'full_time', 'fixed_salary', ?, '1990-01-01', '+962 7 9000 0001', ?, 'Street', 'Kin', '+962 7 9000 0002', '2025-01-01')`,
    [organizationId, `DRV-${n}`, `Driver${n}`, `NID${n}`, `drv${n}@cod.test`],
  );
  await database.query(
    `INSERT INTO delivery_drivers (employee_id, organization_id, driver_category, fleet_arrangement, license_number, license_class, license_expiry_date)
     VALUES (?, ?, 'motorcycle', 'company_vehicle', ?, 'A', '2030-01-01')`,
    [insertId, organizationId, `LIC-${n}`],
  );
  return String(insertId);
}

async function parcel(organizationId, clientId, driverId, cod, fee, status = 'delivered') {
  const n = next();
  const { insertId } = await database.query(
    `INSERT INTO parcels (organization_id, tracking_number, client_id, assigned_driver_id, recipient_name, recipient_phone, delivery_address,
       delivery_city_zone, delivery_fee, cod_amount, lifecycle_status, delivered_at)
     VALUES (?, ?, ?, ?, 'Recipient', '+962 7 9000 0003', 'Address', 'Zone A', ?, ?, ?, NOW())`,
    [organizationId, `TRK-COD-${n}`, clientId, driverId, fee, cod, status],
  );
  return String(insertId);
}

const body = (driverId, parcelIds, cash, reference) => ({ driverId, parcelIds, totalCashDropped: cash, settlementReference: reference ?? `REF-${next()}` });
const refused = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return typeof error.getResponse === 'function' ? error.getResponse() : { thrown: error.message };
  }
  return assert.fail('expected the request to be refused');
};
const ledgerOf = async (clientId) =>
  (await database.getRepository(MerchantLedgerEntry).find({ where: { clientId }, order: { id: 'ASC' } })).map((row) => [row.referenceType, row.entryType, row.amount, row.balanceAfter]);
const balances = async (clientId) => {
  const row = await database.getRepository(Client).findOneByOrFail({ id: clientId });
  return [row.currentBalance, row.pendingCodBalance];
};
const counts = async () => [
  await database.getRepository(DriverCodSettlement).count(), await database.getRepository(DriverCodCollection).count(),
  await database.getRepository(MerchantLedgerEntry).count(), await database.getRepository(AuditLog).count({ where: { resourceType: 'settlement' } }),
];

test('cashier choices include a former driver until their final cash is settled and exclude other companies', async () => {
  const clientId = await merchant(meridian, '20.00');
  const former = await driver(meridian);
  const noCash = await driver(meridian);
  const active = await driver(meridian);
  const foreign = await driver(harbor);
  const undelivered = await driver(meridian);
  for (const id of [former, noCash, foreign, undelivered]) {
    await database.query("UPDATE employees SET employment_status = 'terminated' WHERE id = ?", [id]);
  }
  const parcelId = await parcel(meridian, clientId, former, '20.00', '0.00');
  await parcel(meridian, clientId, undelivered, '5.00', '0.00', 'out_for_delivery');
  let choices = await service.drivers(actor(meridian).tenant);
  assert.ok(choices.some((row) => row.id === active));
  assert.ok(choices.some((row) => row.id === former && row.name && row.employeeCode));
  assert.ok(!choices.some((row) => [noCash, foreign, undelivered].includes(row.id)));
  assert.equal((await service.waiting(actor(meridian).tenant, former)).expectedTotal, '20.00');
  await service.reconcile(actor(meridian), body(former, [parcelId], '20.00'));
  choices = await service.drivers(actor(meridian).tenant);
  assert.ok(!choices.some((row) => row.id === former));
});

test('a driver owes only delivered parcels of their own company that no settlement has taken', async () => {
  const one = await merchant(meridian, '60.00');
  const mine = await driver(meridian);
  const other = await driver(meridian);
  const foreign = await driver(harbor);
  const a = await parcel(meridian, one, mine, '100.00', '7.00');
  const b = await parcel(meridian, one, mine, '50.50', '7.00');
  await parcel(meridian, one, mine, '30.00', '7.00', 'out_for_delivery');
  await parcel(meridian, one, other, '40.00', '7.00');
  const taken = await parcel(meridian, one, mine, '60.00', '7.00');
  await service.reconcile(actor(meridian), body(mine, [taken], '60.00'));

  const view = await service.waiting(actor(meridian).tenant, mine);
  assert.deepEqual(view.parcels.map((row) => row.id), [a, b]);
  assert.equal(view.expectedTotal, '150.50');
  assert.deepEqual(await service.waiting(actor(harbor).tenant, foreign), { driverId: foreign, expectedTotal: '0.00', parcels: [] });
  // A driver of another company, or no driver at all, is not found.
  assert.equal((await refused(service.waiting(actor(meridian).tenant, foreign))).code, 'COD_DRIVER_NOT_FOUND');
  assert.equal((await refused(service.waiting(actor(meridian).tenant, 'abc'))).code, 'COD_DRIVER_NOT_FOUND');
});

test('a handover credits each merchant, charges the fees, clears the pending balance, and is audited once', async () => {
  const first = await merchant(meridian, '150.00');
  const second = await merchant(meridian, '20.00');
  const drv = await driver(meridian);
  const p1 = await parcel(meridian, first, drv, '100.00', '7.00');
  const p2 = await parcel(meridian, first, drv, '50.00', '7.00');
  const p3 = await parcel(meridian, second, drv, '20.00', '5.00');

  const view = await service.reconcile(actor(meridian), body(drv, [p3, p1, p2], '170.00', 'DAY-ONE'));
  assert.deepEqual([view.status, view.totalCodExpected, view.totalCashDropped, view.discrepancyAmount, view.repeated, view.reference], ['verified', '170.00', '170.00', '0.00', false, 'DAY-ONE']);
  assert.deepEqual(view.parcels.map((row) => row.id), [p1, p2, p3]);

  assert.deepEqual(await ledgerOf(first), [
    ['cod_credit', 'credit', '100.00', '100.00'], ['delivery_fee_debit', 'debit', '7.00', '93.00'],
    ['cod_credit', 'credit', '50.00', '143.00'], ['delivery_fee_debit', 'debit', '7.00', '136.00'],
  ]);
  assert.deepEqual(await ledgerOf(second), [['cod_credit', 'credit', '20.00', '20.00'], ['delivery_fee_debit', 'debit', '5.00', '15.00']]);
  assert.deepEqual(await balances(first), ['136.00', '0.00']);
  assert.deepEqual(await balances(second), ['15.00', '0.00']);

  const settlement = await database.getRepository(DriverCodSettlement).findOneByOrFail({ settlementReference: `${meridian}-DAY-ONE` });
  assert.deepEqual([settlement.driverId, settlement.reconciledByUserId, settlement.settlementStatus], [drv, cashier, 'verified']);
  const collections = await database.getRepository(DriverCodCollection).find({ where: { settlementId: settlement.id }, order: { parcelId: 'ASC' } });
  assert.deepEqual(collections.map((row) => [row.parcelId, row.amountCollected, row.paymentMethod]), [[p1, '100.00', 'cash'], [p2, '50.00', 'cash'], [p3, '20.00', 'cash']]);
  // The credit points at its collection, the fee at its parcel.
  const credit = (await database.getRepository(MerchantLedgerEntry).find({ where: { clientId: first }, order: { id: 'ASC' } }))[0];
  assert.equal(credit.referenceId, collections[0].id);
  const audit = await database.getRepository(AuditLog).find({ where: { resourceType: 'settlement', recordId: settlement.id } });
  assert.equal(audit.length, 1);
  assert.deepEqual([audit[0].organizationId, audit[0].userId, audit[0].module, audit[0].action], [meridian, cashier, 'billing', 'create']);
  // Nothing is waiting any more.
  assert.equal((await service.waiting(actor(meridian).tenant, drv)).parcels.length, 0);
});

test('the same reference again answers with the same sheet and records nothing new', async () => {
  const one = await merchant(meridian, '100.00');
  const drv = await driver(meridian);
  const other = await driver(meridian);
  const p = await parcel(meridian, one, drv, '100.00', '7.00');
  const first = await service.reconcile(actor(meridian), body(drv, [p], '100.00', 'REPEAT-1'));
  const before = await counts();

  const again = await service.reconcile(actor(meridian), body(drv, [p], '100.00', 'REPEAT-1'));
  assert.deepEqual([again.repeated, again.id, again.totalCodExpected], [true, first.id, '100.00']);
  assert.deepEqual(await counts(), before);
  assert.deepEqual(await balances(one), ['93.00', '0.00']);
  // The reference belongs to the driver it was first used for.
  assert.equal((await refused(service.reconcile(actor(meridian), body(other, [p], '100.00', 'REPEAT-1')))).code, 'COD_REFERENCE_REUSED');

  // Another company can use the same words: the stored reference carries the company id.
  const harborMerchant = await merchant(harbor, '10.00');
  const harborDriver = await driver(harbor);
  const harborParcel = await parcel(harbor, harborMerchant, harborDriver, '10.00', '1.00');
  const theirs = await service.reconcile(actor(harbor), body(harborDriver, [harborParcel], '10.00', 'REPEAT-1'));
  assert.deepEqual([theirs.repeated, theirs.id === first.id], [false, false]);
});

test('a reused reference rejects changed cash or parcels and leaves the new handover unsettled', async () => {
  const one = await merchant(meridian, '250.00');
  const drv = await driver(meridian);
  const a = await parcel(meridian, one, drv, '100.00', '7.00');
  const zero = await parcel(meridian, one, drv, '0.00', '0.00');
  const b = await parcel(meridian, one, drv, '100.00', '7.00');
  const c = await parcel(meridian, one, drv, '50.00', '7.00');
  const first = await service.reconcile(actor(meridian), body(drv, [a, zero], '100.00', 'SAME-HANDOVER'));
  const before = await counts();
  const ledgerBefore = await ledgerOf(one);

  for (const [ids, cash] of [
    [[a, zero], '99.99'], [[a, zero], '100.01'], [[a], '100.00'],
    [[a, zero, b], '200.00'], [[b, zero], '100.00'], [[c], '50.00'],
  ]) {
    const error = await refused(service.reconcile(actor(meridian), body(drv, ids, cash, 'SAME-HANDOVER')));
    assert.equal(error.code, 'COD_REFERENCE_REUSED');
    assert.deepEqual(await counts(), before);
    assert.deepEqual(await ledgerOf(one), ledgerBefore);
    assert.deepEqual(await balances(one), ['93.00', '150.00']);
  }
  assert.deepEqual((await service.waiting(actor(meridian).tenant, drv)).parcels.map((row) => row.id), [b, c]);
  // Reordering the identical parcel set and normalizing cash are genuine retries, including its zero-COD parcel.
  const retry = await service.reconcile(actor(meridian), body(drv, [zero, a], '0000100.00', 'SAME-HANDOVER'));
  assert.deepEqual([retry.id, retry.repeated, retry.totalCashDropped], [first.id, true, '100.00']);
  assert.deepEqual(await counts(), before);
  // The refused later handover remains available and succeeds with its own reference.
  assert.equal((await service.reconcile(actor(meridian), body(drv, [c], '50.00', 'LATER-HANDOVER'))).repeated, false);
  assert.deepEqual(await balances(one), ['136.00', '100.00']);
});

test('concurrent reordered retries record one handover', async () => {
  const one = await merchant(meridian, '150.00');
  const drv = await driver(meridian);
  const a = await parcel(meridian, one, drv, '100.00', '7.00');
  const b = await parcel(meridian, one, drv, '50.00', '7.00');
  const before = await counts();
  const results = await Promise.all([
    service.reconcile(actor(meridian), body(drv, [a, b], '150.00', 'RACE-REORDERED')),
    service.reconcile(actor(meridian), body(drv, [b, a], '150.00', 'RACE-REORDERED')),
  ]);
  assert.equal(results[0].id, results[1].id);
  assert.deepEqual(results.map((row) => row.repeated).sort(), [false, true]);
  assert.deepEqual(await counts(), before.map((count, index) => count + [1, 2, 4, 1][index]));
  assert.deepEqual(await balances(one), ['136.00', '0.00']);
});

test('concurrent different handovers using the same reference accept one and refuse the other', async () => {
  const one = await merchant(meridian, '200.00');
  const drv = await driver(meridian);
  const a = await parcel(meridian, one, drv, '100.00', '7.00');
  const b = await parcel(meridian, one, drv, '100.00', '7.00');
  const before = await counts();
  const results = await Promise.allSettled([
    service.reconcile(actor(meridian), body(drv, [a], '100.00', 'RACE-DIFFERENT')),
    service.reconcile(actor(meridian), body(drv, [b], '100.00', 'RACE-DIFFERENT')),
  ]);
  const accepted = results.filter((row) => row.status === 'fulfilled');
  const rejected = results.filter((row) => row.status === 'rejected');
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].value.repeated, false);
  assert.equal(rejected.length, 1);
  assert.equal(typeof rejected[0].reason.getStatus, 'function', rejected[0].reason.message);
  assert.equal(rejected[0].reason.getStatus(), 409);
  assert.equal(rejected[0].reason.getResponse().code, 'COD_REFERENCE_REUSED');
  assert.deepEqual(await counts(), before.map((count, index) => count + [1, 1, 2, 1][index]));
  assert.deepEqual(await balances(one), ['93.00', '100.00']);
  const recorded = accepted[0].value.parcels[0].id;
  assert.deepEqual((await service.waiting(actor(meridian).tenant, drv)).parcels.map((row) => row.id), [recorded === a ? b : a]);
});

test('different references cannot settle the same parcels twice under read-committed isolation', async () => {
  const one = await merchant(meridian, '100.00');
  const drv = await driver(meridian);
  const p = await parcel(meridian, one, drv, '100.00', '7.00');
  const before = await counts();
  const results = await Promise.allSettled([
    service.reconcile(actor(meridian), body(drv, [p], '100.00', 'RACE-REF-FIRST')),
    service.reconcile(actor(meridian), body(drv, [p], '100.00', 'RACE-REF-SECOND')),
  ]);
  const accepted = results.filter((row) => row.status === 'fulfilled');
  const rejected = results.filter((row) => row.status === 'rejected');
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].value.repeated, false);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.getResponse().code, 'COD_PARCELS_NOT_ELIGIBLE');
  assert.deepEqual(await counts(), before.map((count, index) => count + [1, 1, 2, 1][index]));
  assert.deepEqual(await balances(one), ['93.00', '0.00']);
});

test('two identical requests at once record one handover', async () => {
  const one = await merchant(meridian, '100.00');
  const drv = await driver(meridian);
  const p = await parcel(meridian, one, drv, '100.00', '7.00');
  const request = body(drv, [p], '100.00', 'RACE-1');
  const results = await Promise.all([service.reconcile(actor(meridian), request), service.reconcile(actor(meridian), request)]);
  assert.deepEqual(results.map((view) => view.repeated).sort(), [false, true]);
  assert.equal(results[0].id, results[1].id);
  assert.deepEqual(await ledgerOf(one), [['cod_credit', 'credit', '100.00', '100.00'], ['delivery_fee_debit', 'debit', '7.00', '93.00']]);
  assert.deepEqual(await balances(one), ['93.00', '0.00']);
});

test('cash that is not the expected total is refused and nothing is stored', async () => {
  const one = await merchant(meridian, '150.00');
  const drv = await driver(meridian);
  const a = await parcel(meridian, one, drv, '100.00', '7.00');
  const b = await parcel(meridian, one, drv, '50.00', '7.00');
  const before = await counts();
  for (const cash of ['149.99', '150.01', '0.00']) {
    const answer = await refused(service.reconcile(actor(meridian), body(drv, [a, b], cash)));
    assert.equal(answer.code, 'COD_DISCREPANCY');
    // Only the message and code reach the client, so the amounts must be in the message.
    assert.ok(answer.message.includes(cash) && answer.message.includes('150.00'));
    assert.deepEqual(Object.keys(answer).sort(), ['code', 'message']);
  }
  assert.deepEqual(await counts(), before);
  assert.deepEqual(await balances(one), ['0.00', '150.00']);
  // The parcels are still waiting, and the right amount goes through.
  assert.equal((await service.waiting(actor(meridian).tenant, drv)).parcels.length, 2);
  assert.equal((await service.reconcile(actor(meridian), body(drv, [a, b], '150.00'))).status, 'verified');
});

test('parcels that cannot be settled refuse the whole handover', async () => {
  const one = await merchant(meridian, '10.00');
  const drv = await driver(meridian);
  const other = await driver(meridian);
  const foreignDriver = await driver(harbor);
  const foreignMerchant = await merchant(harbor);
  const good = await parcel(meridian, one, drv, '10.00', '1.00');
  const ofOther = await parcel(meridian, one, other, '10.00', '1.00');
  const notDelivered = await parcel(meridian, one, drv, '10.00', '1.00', 'in_hub_sorted');
  const foreign = await parcel(harbor, foreignMerchant, foreignDriver, '10.00', '1.00');
  const settled = await parcel(meridian, one, drv, '10.00', '1.00');
  await service.reconcile(actor(meridian), body(drv, [settled], '10.00'));
  const before = await counts();
  for (const bad of [ofOther, notDelivered, foreign, settled, '999999999']) {
    const answer = await refused(service.reconcile(actor(meridian), body(drv, [good, bad], '20.00')));
    assert.equal(answer.code, 'COD_PARCELS_NOT_ELIGIBLE');
  }
  assert.equal((await refused(service.reconcile(actor(meridian), body(foreignDriver, [foreign], '10.00')))).code, 'COD_DRIVER_NOT_FOUND');
  assert.deepEqual(await counts(), before);
  assert.deepEqual(await balances(one), ['9.00', '0.00']);
});

test('a failure after the ledger is posted rolls the whole handover back', async () => {
  const one = await merchant(meridian, '100.00');
  const drv = await driver(meridian);
  const p = await parcel(meridian, one, drv, '100.00', '7.00');
  const broken = new CodService(new CodRepository(database), new LedgerService(new LedgerRepository()), { record: async () => { throw new Error('audit down'); } });
  const before = await counts();
  assert.deepEqual(await refused(broken.reconcile(actor(meridian), body(drv, [p], '100.00'))), { thrown: 'audit down' });
  assert.deepEqual(await counts(), before);
  assert.deepEqual(await ledgerOf(one), []);
  assert.deepEqual(await balances(one), ['0.00', '100.00']);
  assert.equal((await service.waiting(actor(meridian).tenant, drv)).parcels.length, 1);
});

test('a parcel with no COD and no fee is settled without a ledger line', async () => {
  const one = await merchant(meridian, '25.00');
  const drv = await driver(meridian);
  const free = await parcel(meridian, one, drv, '0.00', '0.00');
  const paid = await parcel(meridian, one, drv, '25.00', '0.00');
  const view = await service.reconcile(actor(meridian), body(drv, [free, paid], '25.00'));
  assert.equal(view.parcels.length, 2);
  assert.deepEqual(await ledgerOf(one), [['cod_credit', 'credit', '25.00', '25.00']]);
  const lone = await merchant(meridian);
  const alone = await parcel(meridian, lone, drv, '0.00', '0.00');
  await service.reconcile(actor(meridian), body(drv, [alone], '0.00'));
  assert.deepEqual(await ledgerOf(lone), []);
  assert.deepEqual(await balances(lone), ['0.00', '0.00']);
});

test('parcels whose cash never entered the merchant pending balance are refused and nothing is stored', async () => {
  const short = await merchant(meridian, '30.00');
  const drv = await driver(meridian);
  const a = await parcel(meridian, short, drv, '100.00', '7.00');
  const before = await counts();
  const answer = await refused(service.reconcile(actor(meridian), body(drv, [a], '100.00')));
  assert.equal(answer.code, 'COD_PENDING_TOO_LOW');
  assert.deepEqual(await counts(), before);
  assert.deepEqual(await balances(short), ['0.00', '30.00']);
  assert.equal((await service.waiting(actor(meridian).tenant, drv)).parcels.length, 1);
});
