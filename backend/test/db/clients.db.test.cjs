const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { recordAudit } = require('../../dist/modules/audit');
const { AuditLog } = require('../../dist/modules/audit/entities/audit-log.entity');
const { ClientsRepository } = require('../../dist/modules/clients/clients.repository');
const { Client } = require('../../dist/modules/clients/entities/client.entity');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');

let database;
let clients;
let meridian;
let harbor;
before(async () => {
  database = await createTestDatabase();
  clients = new ClientsRepository(database);
  const organizations = database.getRepository(Organization);
  meridian = (await organizations.save({ name: 'Clients Meridian', slug: 'clients-meridian', contactEmail: 'ops@meridian.db.test' })).id;
  harbor = (await organizations.save({ name: 'Clients Harbor', slug: 'clients-harbor', contactEmail: 'ops@harbor.db.test' })).id;
});
after(() => database?.destroy());

const values = (code, businessName, extra = {}) => ({
  clientCode: code, businessName, tradeLicenseNo: null, contactPersonName: `${businessName} contact`, contactTitle: null,
  mobile1: '+962 7 9000 0000', mobile2: null, email: `${code.toLowerCase()}@clients.db.test`, billingAddress: 'Billing street',
  defaultPickupAddress: 'Pickup street', pickupLatitude: null, pickupLongitude: null, rateProfileTier: 'standard',
  operationalNotes: null, ...extra,
});
const noAudit = async () => {};
const query = (extra = {}) => ({ status: 'all', sort: 'businessName', direction: 'asc', page: 1, pageSize: 10, ...extra });

async function create(organizationId, code, businessName, extra) {
  const result = await clients.create(organizationId, values(code, businessName, extra), noAudit);
  assert.equal(result.status, 'created');
  return result.client;
}

test('a new client is saved with the column defaults, and its code once per company', async () => {
  const client = await create(meridian, 'DB-0001', 'Paper & Co.', { pickupLatitude: '31.87012400', pickupLongitude: '36.00521300' });
  assert.deepEqual(
    [client.organizationId, client.currentBalance, client.pendingCodBalance, client.isActive, client.pickupLatitude],
    [meridian, '0.00', '0.00', true, '31.87012400'],
  );
  assert.ok(client.createdAt instanceof Date);
  assert.deepEqual(await clients.create(meridian, values('DB-0001', 'Again'), noAudit), { status: 'code_taken' });
  // Two requests at once: the unique key stops the second.
  const raced = await Promise.all([1, 2].map(() => clients.create(meridian, values('DB-RACE', 'Race'), noAudit)));
  assert.deepEqual(raced.map((result) => result.status).sort(), ['code_taken', 'created']);
  // Another company may use the same code.
  await create(harbor, 'DB-0001', 'Harbor Paper');
});

test('the list searches, filters, sorts and pages within one company; the counts cover the company', async () => {
  await create(meridian, 'DB-0002', 'Atlas 100% Cotton');
  await create(meridian, 'DB-0003', 'Bloom Florists', { pickupLatitude: '31.94580100', pickupLongitude: '35.88302500' });
  const bloom = (await clients.list(meridian, query({ search: 'Bloom' }))).items[0];
  await clients.setActive(meridian, bloom.id, false, noAudit);

  const names = async (extra) => (await clients.list(meridian, query(extra))).items.map((client) => client.businessName);
  assert.deepEqual(await names({ status: 'active' }), ['Atlas 100% Cotton', 'Paper & Co.', 'Race']);
  assert.deepEqual(await names({ status: 'archived' }), ['Bloom Florists']);
  assert.deepEqual(await names({ sort: 'clientCode', direction: 'desc' }), ['Race', 'Bloom Florists', 'Atlas 100% Cotton', 'Paper & Co.']);
  // A wildcard typed in the search is a plain character.
  assert.deepEqual(await names({ search: '100%' }), ['Atlas 100% Cotton']);
  assert.deepEqual(await names({ search: '%' }), ['Atlas 100% Cotton']);
  assert.deepEqual(await names({ search: 'db-0003' }), ['Bloom Florists']);
  assert.deepEqual(await names({ search: 'paper & co. contact' }), ['Paper & Co.']);
  assert.deepEqual(await names({ search: 'Harbor' }), []);

  const pages = await Promise.all([1, 2].map((page) => clients.list(meridian, query({ pageSize: 10, page }))));
  assert.deepEqual(pages.map(({ items, total }) => [items.length, total]), [[4, 4], [0, 4]]);
  assert.deepEqual(await clients.counts(meridian), { total: 4, active: 3, archived: 1, pinned: 1 });
  assert.deepEqual(await clients.counts(harbor), { total: 1, active: 1, archived: 0, pinned: 0 });
});

test('changes stay inside the company, save only what changed, and roll back with a failed audit', async () => {
  const atlas = (await clients.list(meridian, query({ search: 'Atlas' }))).items[0];
  const harborClient = (await clients.list(harbor, query())).items[0];
  assert.equal(await clients.find(meridian, harborClient.id), null);
  assert.deepEqual(await clients.update(meridian, harborClient.id, { businessName: 'Taken over' }, noAudit), { status: 'not_found' });
  assert.deepEqual(await clients.setActive(meridian, harborClient.id, false, noAudit), { status: 'not_found' });
  assert.equal((await clients.find(harbor, harborClient.id)).businessName, 'Harbor Paper');

  assert.equal((await clients.update(meridian, atlas.id, { businessName: atlas.businessName }, noAudit)).status, 'unchanged');
  assert.deepEqual(await clients.update(meridian, atlas.id, { clientCode: 'DB-0001' }, noAudit), { status: 'code_taken' });

  const audited = [];
  const updated = await clients.update(meridian, atlas.id, { contactTitle: 'Owner', businessName: 'Atlas Cotton' }, async (manager, old, saved) => {
    audited.push([old.businessName, saved.businessName]);
    await recordAudit(manager, {
      module: 'clients', action: 'update', resourceType: 'client', recordId: saved.id, resourceLabel: saved.businessName,
      organizationId: meridian, actorId: null, before: old, after: saved,
    });
  });
  assert.equal(updated.status, 'updated');
  assert.deepEqual(audited, [['Atlas 100% Cotton', 'Atlas Cotton']]);
  const row = await database.getRepository(AuditLog).findOneByOrFail({ resourceType: 'client', recordId: atlas.id });
  assert.deepEqual([row.module, row.organizationId, row.oldValues, row.newValues], [
    'clients', meridian, { businessName: 'Atlas 100% Cotton', contactTitle: null }, { businessName: 'Atlas Cotton', contactTitle: 'Owner' },
  ]);

  const failing = async () => { throw new Error('audit unavailable'); };
  await assert.rejects(clients.update(meridian, atlas.id, { businessName: 'Lost change' }, failing), /audit unavailable/);
  await assert.rejects(clients.setActive(meridian, atlas.id, false, failing), /audit unavailable/);
  const kept = await database.getRepository(Client).findOneByOrFail({ id: atlas.id });
  assert.deepEqual([kept.businessName, kept.isActive], ['Atlas Cotton', true]);
});
