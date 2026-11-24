const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { AuditLog, AuditService } = require('../../dist/modules/audit');
const { LedgerRepository } = require('../../dist/modules/billing/ledger.repository');
const { LedgerService } = require('../../dist/modules/billing/ledger.service');
const { PayoutsRepository } = require('../../dist/modules/billing/payouts.repository');
const { PayoutsService } = require('../../dist/modules/billing/payouts.service');
const { MerchantLedgerEntry } = require('../../dist/modules/billing/entities/merchant-ledger-entry.entity');
const { ClientsRepository } = require('../../dist/modules/clients/clients.repository');
const { Client } = require('../../dist/modules/clients/entities/client.entity');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');
const { User } = require('../../dist/modules/users/entities/user.entity');

let database;
let service;
let meridian;
let harbor;
let finance;
before(async () => {
  database = await createTestDatabase();
  const ledgerRepository = new LedgerRepository();
  service = new PayoutsService(new PayoutsRepository(database, ledgerRepository), new LedgerService(ledgerRepository), new AuditService(database.getRepository(AuditLog)));
  const organizations = database.getRepository(Organization);
  meridian = (await organizations.save({ name: 'Payout Meridian', slug: 'payout-meridian', contactEmail: 'ops@meridian.payout.test' })).id;
  harbor = (await organizations.save({ name: 'Payout Harbor', slug: 'payout-harbor', contactEmail: 'ops@harbor.payout.test' })).id;
  finance = String((await database.getRepository(User).save({ username: 'finance.payout', email: 'finance@payout.test', passwordHash: 'placeholder-hash' })).id);
});
after(() => database?.destroy());

const actor = (organizationId) => ({ tenant: { organizationId, roleId: '1' }, userId: finance, meta: { ip: '127.0.0.1', userAgent: 'test' } });
let counter = 0;
const next = () => (counter += 1);

async function merchant(organizationId, balance = '0.00') {
  const n = next();
  const result = await new ClientsRepository(database).create(organizationId, {
    clientCode: `PO-${n}`, businessName: `Payout merchant ${n}`, tradeLicenseNo: null, contactPersonName: 'Contact', contactTitle: null,
    mobile1: '+962 7 9000 0000', mobile2: null, email: `po${n}@payout.test`, billingAddress: 'Billing street',
    defaultPickupAddress: 'Pickup street', pickupLatitude: null, pickupLongitude: null, rateProfileTier: 'standard', operationalNotes: null,
  }, async () => {});
  await database.query('UPDATE clients SET current_balance = ? WHERE id = ?', [balance, result.client.id]);
  return result.client.id;
}

async function invoice(organizationId, clientId, status) {
  const n = next();
  const { insertId } = await database.query(
    `INSERT INTO invoices (organization_id, invoice_number, client_id, billing_period_start, billing_period_end, status, issue_date, due_date, created_by_user_id)
     VALUES (?, ?, ?, '2026-10-01', '2026-10-31', ?, '2026-11-01', '2026-11-15', ?)`,
    [organizationId, `INV-PO-${n}`, clientId, status, finance],
  );
  return String(insertId);
}
const statusOf = async (id) => (await database.query('SELECT status FROM invoices WHERE id = ?', [id]))[0].status;
const body = (clientId, amount, wireReference) => ({ clientId, amount, wireReference: wireReference ?? `WIRE-${next()}` });
const refused = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return typeof error.getResponse === 'function' ? error.getResponse() : { thrown: error.message };
  }
  return assert.fail('expected the request to be refused');
};
const balanceOf = async (clientId) => (await database.getRepository(Client).findOneByOrFail({ id: clientId })).currentBalance;
const ledgerCount = () => database.getRepository(MerchantLedgerEntry).count({ where: { referenceType: 'payout_disbursement' } });
const auditCount = () => database.getRepository(AuditLog).count({ where: { resourceType: 'payout' } });

test('a partial payout debits the balance, is audited once, and leaves the invoices issued', async () => {
  const id = await merchant(meridian, '500.00');
  const open = await invoice(meridian, id, 'issued');
  const view = await service.create(actor(meridian), body(id, '200.00', 'WIRE-PART-1'));
  assert.deepEqual([view.amount, view.balanceAfter, view.repeated, view.wireReference, view.clientId], ['200.00', '300.00', false, 'WIRE-PART-1', id]);
  assert.equal(await balanceOf(id), '300.00');
  assert.equal(await statusOf(open), 'issued');
  const row = await database.getRepository(MerchantLedgerEntry).findOneByOrFail({ id: view.id });
  assert.deepEqual([row.referenceType, row.entryType, row.description, row.referenceId], ['payout_disbursement', 'debit', 'Payout WIRE-PART-1', null]);
  assert.equal(await database.getRepository(AuditLog).count({ where: { resourceType: 'payout', recordId: view.id } }), 1);
});

test('a payout that clears the whole balance marks only that merchant\'s issued invoices paid', async () => {
  const id = await merchant(meridian, '132.50');
  const other = await merchant(meridian, '80.00');
  const issuedOne = await invoice(meridian, id, 'issued');
  const issuedTwo = await invoice(meridian, id, 'issued');
  const draft = await invoice(meridian, id, 'draft');
  const offset = await invoice(meridian, id, 'paid_via_balance_offset');
  const othersInvoice = await invoice(meridian, other, 'issued');

  const view = await service.create(actor(meridian), body(id, '132.50', 'WIRE-FULL-1'));
  assert.equal(view.balanceAfter, '0.00');
  assert.deepEqual(
    [await statusOf(issuedOne), await statusOf(issuedTwo), await statusOf(draft), await statusOf(offset), await statusOf(othersInvoice)],
    ['paid_via_bank_transfer', 'paid_via_bank_transfer', 'draft', 'paid_via_balance_offset', 'issued'],
  );
  const audit = await database.getRepository(AuditLog).findOneByOrFail({ resourceType: 'payout', recordId: view.id });
  assert.deepEqual(audit.metadata, { invoicesPaid: 2 });
});

test('a payout above the balance is refused and nothing is stored', async () => {
  const id = await merchant(meridian, '50.00');
  const empty = await merchant(meridian, '0.00');
  const owing = await merchant(meridian, '-10.00');
  const before = [await ledgerCount(), await auditCount()];
  const refusal = await refused(service.create(actor(meridian), body(id, '50.01')));
  assert.deepEqual([refusal.code, refusal.balance], ['PAYOUT_EXCEEDS_BALANCE', '50.00']);
  assert.equal((await refused(service.create(actor(meridian), body(empty, '1.00')))).code, 'PAYOUT_EXCEEDS_BALANCE');
  assert.equal((await refused(service.create(actor(meridian), body(owing, '1.00')))).code, 'PAYOUT_EXCEEDS_BALANCE');
  assert.deepEqual([await ledgerCount(), await auditCount()], before);
  assert.equal(await balanceOf(id), '50.00');
});

test('the same wire reference again answers with the first payout and writes nothing new', async () => {
  const id = await merchant(meridian, '300.00');
  const first = await service.create(actor(meridian), body(id, '100.00', 'WIRE-REPEAT-1'));
  const counts = [await ledgerCount(), await auditCount()];
  const again = await service.create(actor(meridian), body(id, '100.00', 'WIRE-REPEAT-1'));
  assert.deepEqual([again.id, again.repeated, again.balanceAfter], [first.id, true, '200.00']);
  assert.deepEqual([await ledgerCount(), await auditCount()], counts);
  assert.equal(await balanceOf(id), '200.00');
  // The same reference with another amount is not the same payout.
  assert.equal((await refused(service.create(actor(meridian), body(id, '50.00', 'WIRE-REPEAT-1')))).code, 'PAYOUT_REFERENCE_REUSED');
  assert.equal(await balanceOf(id), '200.00');
});

test('two requests with the same reference at the same time pay out once', async () => {
  const id = await merchant(meridian, '300.00');
  const results = await Promise.all([
    service.create(actor(meridian), body(id, '100.00', 'WIRE-RACE-1')),
    service.create(actor(meridian), body(id, '100.00', 'WIRE-RACE-1')),
  ]);
  assert.deepEqual(results.map((row) => row.repeated).sort(), [false, true]);
  assert.equal(results[0].id, results[1].id);
  assert.equal(await balanceOf(id), '200.00');
});

test('two different payouts at the same time cannot overdraw the balance', async () => {
  const id = await merchant(meridian, '100.00');
  const outcomes = await Promise.allSettled([
    service.create(actor(meridian), body(id, '80.00', 'WIRE-DRAW-A')),
    service.create(actor(meridian), body(id, '80.00', 'WIRE-DRAW-B')),
  ]);
  assert.deepEqual(outcomes.map((row) => row.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(await balanceOf(id), '20.00');
});

test('another company\'s merchant, or none at all, is not found', async () => {
  const foreign = await merchant(harbor, '100.00');
  assert.equal((await refused(service.create(actor(meridian), body(foreign, '10.00')))).code, 'PAYOUT_MERCHANT_NOT_FOUND');
  assert.equal((await refused(service.create(actor(meridian), body('999999999', '10.00')))).code, 'PAYOUT_MERCHANT_NOT_FOUND');
  assert.equal(await balanceOf(foreign), '100.00');
});

test('a failing audit rolls the payout back', async () => {
  const id = await merchant(meridian, '100.00');
  const broken = new PayoutsService(new PayoutsRepository(database, new LedgerRepository()), new LedgerService(new LedgerRepository()), { record: async () => { throw new Error('audit down'); } });
  assert.equal((await refused(broken.create(actor(meridian), body(id, '40.00', 'WIRE-ROLL-1')))).thrown, 'audit down');
  assert.equal(await balanceOf(id), '100.00');
  assert.equal(await database.getRepository(MerchantLedgerEntry).count({ where: { clientId: id, referenceType: 'payout_disbursement' } }), 0);
});
