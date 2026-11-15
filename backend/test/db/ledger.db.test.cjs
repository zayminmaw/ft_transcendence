const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { LedgerRepository } = require('../../dist/modules/billing/ledger.repository');
const { LedgerService } = require('../../dist/modules/billing/ledger.service');
const { MerchantLedgerEntry } = require('../../dist/modules/billing/entities/merchant-ledger-entry.entity');
const { ClientsRepository } = require('../../dist/modules/clients/clients.repository');
const { Client } = require('../../dist/modules/clients/entities/client.entity');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');

let database;
let ledger;
let meridian;
let harbor;
before(async () => {
  database = await createTestDatabase();
  ledger = new LedgerService(new LedgerRepository());
  const organizations = database.getRepository(Organization);
  meridian = (await organizations.save({ name: 'Ledger Meridian', slug: 'ledger-meridian', contactEmail: 'ops@meridian.ledger.test' })).id;
  harbor = (await organizations.save({ name: 'Ledger Harbor', slug: 'ledger-harbor', contactEmail: 'ops@harbor.ledger.test' })).id;
});
after(() => database?.destroy());

let counter = 0;
async function merchant(organizationId) {
  counter += 1;
  const result = await new ClientsRepository(database).create(organizationId, {
    clientCode: `LG-${counter}`, businessName: `Ledger merchant ${counter}`, tradeLicenseNo: null, contactPersonName: 'Contact', contactTitle: null,
    mobile1: '+962 7 9000 0000', mobile2: null, email: `lg${counter}@ledger.test`, billingAddress: 'Billing street',
    defaultPickupAddress: 'Pickup street', pickupLatitude: null, pickupLongitude: null, rateProfileTier: 'standard', operationalNotes: null,
  }, async () => {});
  assert.equal(result.status, 'created');
  return result.client.id;
}
const line = (direction, amount, extra = {}) => ({
  direction, amount, referenceType: direction === 'credit' ? 'cod_credit' : 'delivery_fee_debit', referenceId: null, description: `${direction} ${amount}`, ...extra,
});
const post = (organizationId, clientId, lines, extra = {}) =>
  database.transaction((manager) => ledger.post(manager, { organizationId, clientId, lines, createdByUserId: null, ...extra }));
const balances = async (clientId) => {
  const row = await database.getRepository(Client).findOneByOrFail({ id: clientId });
  return [row.currentBalance, row.pendingCodBalance];
};
const chain = async (clientId) =>
  (await database.getRepository(MerchantLedgerEntry).find({ where: { clientId }, order: { id: 'ASC' } })).map((row) => [row.entryType, row.amount, row.balanceAfter]);

test('a credit and its fee debit make a chain, and the merchant row ends on the last balance', async () => {
  const client = await merchant(meridian);
  await database.query('UPDATE clients SET pending_cod_balance = 150.00 WHERE id = ?', [client]);
  const result = await post(meridian, client, [line('credit', '100.00'), line('debit', '7.00', { referenceId: '12' })], { pendingChange: '-100.00' });
  assert.equal(result.status, 'posted');
  assert.deepEqual([result.currentBalance, result.pendingCodBalance], ['93.00', '50.00']);
  assert.deepEqual(await chain(client), [['credit', '100.00', '100.00'], ['debit', '7.00', '93.00']]);
  assert.deepEqual(await balances(client), ['93.00', '50.00']);
  assert.equal(result.entries[1].referenceId, '12');
  // A later post continues from the stored balance.
  await post(meridian, client, [line('credit', '50.00'), line('debit', '7.00'), line('debit', '3.50')]);
  assert.deepEqual((await chain(client)).slice(2), [['credit', '50.00', '143.00'], ['debit', '7.00', '136.00'], ['debit', '3.50', '132.50']]);
  assert.deepEqual(await balances(client), ['132.50', '50.00']);
});

test('a merchant of another company is not found and nothing is written', async () => {
  const client = await merchant(meridian);
  assert.deepEqual(await post(harbor, client, [line('credit', '10.00')]), { status: 'client_not_found' });
  assert.deepEqual(await post(meridian, '999999999', [line('credit', '10.00')]), { status: 'client_not_found' });
  assert.deepEqual(await chain(client), []);
  assert.deepEqual(await balances(client), ['0.00', '0.00']);
});

test('two posts at once on one merchant end on the right total, with an unbroken chain', async () => {
  const client = await merchant(meridian);
  const results = await Promise.all(Array.from({ length: 6 }, () => post(meridian, client, [line('credit', '10.00'), line('debit', '2.50')])));
  assert.ok(results.every((result) => result.status === 'posted'));
  assert.deepEqual(await balances(client), ['45.00', '0.00']);
  const rows = await chain(client);
  assert.equal(rows.length, 12);
  // Each balance follows the one before, whichever post got the lock first.
  let expected = 0;
  for (const [type, amount, after] of rows) {
    expected += type === 'credit' ? Number(amount) : -Number(amount);
    assert.equal(Number(after), expected);
  }
  assert.equal(expected, 45);
});

test('a failure partway through leaves the balances and the ledger as they were', async () => {
  const client = await merchant(meridian);
  await post(meridian, client, [line('credit', '20.00')]);
  await assert.rejects(
    database.transaction(async (manager) => {
      await ledger.post(manager, { organizationId: meridian, clientId: client, lines: [line('credit', '5.00')], pendingChange: '1.00', createdByUserId: null });
      throw new Error('audit down');
    }),
    /audit down/,
  );
  assert.deepEqual(await chain(client), [['credit', '20.00', '20.00']]);
  assert.deepEqual(await balances(client), ['20.00', '0.00']);
});

test('a balance may go below zero, and the pending balance moves without a line', async () => {
  const client = await merchant(meridian);
  const result = await post(meridian, client, [line('debit', '45.00')]);
  assert.equal(result.currentBalance, '-45.00');
  assert.deepEqual(await chain(client), [['debit', '45.00', '-45.00']]);
  const moved = await post(meridian, client, [], { pendingChange: '100.00' });
  assert.deepEqual([moved.currentBalance, moved.pendingCodBalance, moved.entries.length], ['-45.00', '100.00', 0]);
  assert.equal((await chain(client)).length, 1);
});

test('bad input throws and writes nothing', async () => {
  const client = await merchant(meridian);
  const bad = [
    [[line('credit', '0.00')], /above zero/],
    [[line('credit', '-5.00')], /above zero/],
    [[line('credit', '5.5')], /not an amount/],
    [[line('credit', '5.00', { referenceId: 'abc' })], /reference id/],
    [[line('credit', '5.00', { description: '' })], /description/],
    [[line('credit', '5.00', { description: 'x'.repeat(256) })], /description/],
    [[], /at least one line/],
  ];
  for (const [lines, message] of bad) await assert.rejects(post(meridian, client, lines), message);
  // More than the column holds is refused instead of stored wrong.
  await post(meridian, client, [line('credit', '9999999999.99')]);
  await assert.rejects(post(meridian, client, [line('credit', '0.01')]), /more than a balance can hold/);
  assert.deepEqual(await balances(client), ['9999999999.99', '0.00']);
  assert.equal((await chain(client)).length, 1);
});
