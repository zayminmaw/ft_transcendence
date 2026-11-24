const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { LedgerHistoryRepository } = require('../../dist/modules/billing/ledger-history.repository');
const { LedgerHistoryService } = require('../../dist/modules/billing/ledger-history.service');
const { LedgerRepository } = require('../../dist/modules/billing/ledger.repository');
const { LedgerService } = require('../../dist/modules/billing/ledger.service');
const { ClientsRepository } = require('../../dist/modules/clients/clients.repository');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');

let database;
let service;
let ledger;
let meridian;
let harbor;
before(async () => {
  database = await createTestDatabase();
  service = new LedgerHistoryService(new LedgerHistoryRepository(database));
  ledger = new LedgerService(new LedgerRepository());
  const organizations = database.getRepository(Organization);
  meridian = (await organizations.save({ name: 'History Meridian', slug: 'history-meridian', contactEmail: 'ops@meridian.history.test' })).id;
  harbor = (await organizations.save({ name: 'History Harbor', slug: 'history-harbor', contactEmail: 'ops@harbor.history.test' })).id;
});
after(() => database?.destroy());

const tenant = (organizationId) => ({ organizationId, roleId: '1' });
let counter = 0;

async function merchant(organizationId) {
  const n = (counter += 1);
  const result = await new ClientsRepository(database).create(organizationId, {
    clientCode: `LH-${n}`, businessName: `History merchant ${n}`, tradeLicenseNo: null, contactPersonName: 'Contact', contactTitle: null,
    mobile1: '+962 7 9000 0000', mobile2: null, email: `lh${n}@history.test`, billingAddress: 'Billing street',
    defaultPickupAddress: 'Pickup street', pickupLatitude: null, pickupLongitude: null, rateProfileTier: 'standard', operationalNotes: null,
  }, async () => {});
  return result.client.id;
}

const post = (organizationId, clientId, direction, amount, description) => database.transaction((manager) => ledger.post(manager, {
  organizationId, clientId, createdByUserId: null,
  lines: [{ direction, amount, referenceType: direction === 'credit' ? 'cod_credit' : 'payout_disbursement', referenceId: null, description }],
}));

test('the ledger comes back newest first with the running balance, and pages cover every line once', async () => {
  const clientId = await merchant(meridian);
  await post(meridian, clientId, 'credit', '100.00', 'first');
  await post(meridian, clientId, 'credit', '50.00', 'second');
  await post(meridian, clientId, 'debit', '30.00', 'third');
  const all = await service.page(tenant(meridian), clientId, { page: 1, pageSize: 10 });
  assert.deepEqual(all.items.map((line) => [line.description, line.entryType, line.amount, line.balanceAfter]), [
    ['third', 'debit', '30.00', '120.00'], ['second', 'credit', '50.00', '150.00'], ['first', 'credit', '100.00', '100.00'],
  ]);
  assert.equal(all.total, 3);
  const first = await service.page(tenant(meridian), clientId, { page: 1, pageSize: 2 });
  const second = await service.page(tenant(meridian), clientId, { page: 2, pageSize: 2 });
  assert.deepEqual([...first.items, ...second.items].map((line) => line.description), ['third', 'second', 'first']);
});

test('a merchant with no lines has an empty ledger, not a 404', async () => {
  const clientId = await merchant(meridian);
  const empty = await service.page(tenant(meridian), clientId, { page: 1, pageSize: 25 });
  assert.deepEqual([empty.items.length, empty.total], [0, 0]);
});

test('another company cannot read this merchant ledger, and a merchant only shows its own lines', async () => {
  const mine = await merchant(meridian);
  const other = await merchant(meridian);
  await post(meridian, mine, 'credit', '10.00', 'mine only');
  await post(meridian, other, 'credit', '20.00', 'other merchant');
  await assert.rejects(service.page(tenant(harbor), mine, { page: 1, pageSize: 25 }), (error) => error.getStatus() === 404);
  const page = await service.page(tenant(meridian), mine, { page: 1, pageSize: 25 });
  assert.deepEqual(page.items.map((line) => line.description), ['mine only']);
});
