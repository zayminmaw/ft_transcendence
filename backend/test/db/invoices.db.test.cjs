const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { AuditLog, AuditService } = require('../../dist/modules/audit');
const { LedgerRepository } = require('../../dist/modules/billing/ledger.repository');
const { InvoicesRepository } = require('../../dist/modules/billing/invoices.repository');
const { InvoicesService } = require('../../dist/modules/billing/invoices.service');
const { Client } = require('../../dist/modules/clients/entities/client.entity');
const { ClientsRepository } = require('../../dist/modules/clients/clients.repository');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');
const { User } = require('../../dist/modules/users/entities/user.entity');

let database;
let service;
let meridian;
let harbor;
let finance;
before(async () => {
  database = await createTestDatabase();
  service = new InvoicesService(new InvoicesRepository(database, new LedgerRepository()), new AuditService(database.getRepository(AuditLog)));
  const organizations = database.getRepository(Organization);
  meridian = (await organizations.save({ name: 'Invoice Meridian', slug: 'invoice-meridian', contactEmail: 'ops@meridian.invoice.test' })).id;
  harbor = (await organizations.save({ name: 'Invoice Harbor', slug: 'invoice-harbor', contactEmail: 'ops@harbor.invoice.test' })).id;
  finance = String((await database.getRepository(User).save({ username: 'finance.invoice', email: 'finance@invoice.test', passwordHash: 'placeholder-hash' })).id);
});
after(() => database?.destroy());

const actor = (organizationId) => ({ tenant: { organizationId, roleId: '1' }, userId: finance, meta: { ip: '127.0.0.1', userAgent: 'test' } });
let counter = 0;
const next = () => (counter += 1);

async function merchant(organizationId) {
  const n = next();
  const result = await new ClientsRepository(database).create(organizationId, {
    clientCode: `IV-${n}`, businessName: `Invoice merchant ${n}`, tradeLicenseNo: null, contactPersonName: 'Contact', contactTitle: null,
    mobile1: '+962 7 9000 0000', mobile2: null, email: `iv${n}@invoice.test`, billingAddress: 'Billing street',
    defaultPickupAddress: 'Pickup street', pickupLatitude: null, pickupLongitude: null, rateProfileTier: 'standard', operationalNotes: null,
  }, async () => {});
  return result.client.id;
}

async function parcel(organizationId, clientId, { fee = '5.00', status = 'delivered', deliveredAt = '2026-10-15 10:00:00' } = {}) {
  const n = next();
  const { insertId } = await database.query(
    `INSERT INTO parcels (organization_id, tracking_number, client_id, recipient_name, recipient_phone, delivery_address,
       delivery_city_zone, delivery_fee, cod_amount, lifecycle_status, delivered_at)
     VALUES (?, ?, ?, 'Recipient', '+962 7 9000 0003', 'Address', 'Zone A', ?, '40.00', ?, ?)`,
    [organizationId, `TRK-INV-${n}`, clientId, fee, status, status === 'delivered' ? deliveredAt : null],
  );
  return String(insertId);
}

const body = (clientId, periodStart = '2026-10-01', periodEnd = '2026-10-31') => ({ clientId, periodStart, periodEnd });
const refused = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return typeof error.getResponse === 'function' ? error.getResponse() : { thrown: error.message };
  }
  return assert.fail('expected the request to be refused');
};
const balanceOf = async (clientId) => (await database.getRepository(Client).findOneByOrFail({ id: clientId })).currentBalance;
const auditCount = () => database.getRepository(AuditLog).count({ where: { resourceType: 'invoice' } });

test('an invoice bills the delivery fee of each delivered parcel in the period, as a draft, and is audited once', async () => {
  const id = await merchant(meridian);
  const a = await parcel(meridian, id, { fee: '5.25' });
  const b = await parcel(meridian, id, { fee: '7.00', deliveredAt: '2026-10-31 23:59:59' });
  const view = await service.create(actor(meridian), { ...body(id), notes: 'October' });

  assert.deepEqual(
    [view.status, view.totalDeliveries, view.totalDeliveryFees, view.netAmountDue, view.clientId, view.periodStart, view.periodEnd, view.notes],
    ['draft', 2, '12.25', '12.25', id, '2026-10-01', '2026-10-31', 'October'],
  );
  assert.deepEqual(view.items.map((item) => [item.parcelId, item.deliveryFee]), [[a, '5.25'], [b, '7.00']]);
  assert.match(view.invoiceNumber, new RegExp(`^INV-${meridian}-\\d{6}$`));
  assert.ok(view.dueDate > view.issueDate);

  const row = (await database.query('SELECT total_cod_collected, net_amount_due FROM invoices WHERE id = ?', [view.id]))[0];
  assert.deepEqual([row.total_cod_collected, row.net_amount_due], ['0.00', '12.25']);
  const lines = await database.query('SELECT delivery_fee, cod_amount, surcharges, net_item_amount FROM invoice_items WHERE invoice_id = ? ORDER BY parcel_id', [view.id]);
  assert.deepEqual(lines.map((line) => [line.delivery_fee, line.cod_amount, line.surcharges, line.net_item_amount]), [['5.25', '0.00', '0.00', '5.25'], ['7.00', '0.00', '0.00', '7.00']]);
  assert.equal(await database.getRepository(AuditLog).count({ where: { resourceType: 'invoice', recordId: view.id } }), 1);
});

test('generating an invoice never changes the merchant balance', async () => {
  const id = await merchant(meridian);
  await database.query("UPDATE clients SET current_balance = '88.00', pending_cod_balance = '12.00' WHERE id = ?", [id]);
  await parcel(meridian, id);
  await service.create(actor(meridian), body(id));
  assert.equal(await balanceOf(id), '88.00');
  assert.equal((await database.getRepository(Client).findOneByOrFail({ id })).pendingCodBalance, '12.00');
});

test('only delivered parcels with a fee, inside the period, are billed', async () => {
  const id = await merchant(meridian);
  const inside = await parcel(meridian, id);
  await parcel(meridian, id, { status: 'out_for_delivery' });
  await parcel(meridian, id, { fee: '0.00' });
  await parcel(meridian, id, { deliveredAt: '2026-09-30 23:59:59' });
  await parcel(meridian, id, { deliveredAt: '2026-11-01 00:00:00' });
  const view = await service.create(actor(meridian), body(id));
  assert.deepEqual(view.items.map((item) => item.parcelId), [inside]);
});

test('a parcel is billed once, so asking again for the same period is refused and a wider period takes only new parcels', async () => {
  const id = await merchant(meridian);
  const first = await parcel(meridian, id, { deliveredAt: '2026-10-10 09:00:00' });
  const one = await service.create(actor(meridian), body(id, '2026-10-01', '2026-10-15'));
  assert.deepEqual(one.items.map((item) => item.parcelId), [first]);

  const before = await auditCount();
  assert.equal((await refused(service.create(actor(meridian), body(id, '2026-10-01', '2026-10-15')))).code, 'INVOICE_NOTHING_TO_BILL');
  assert.equal(await auditCount(), before);

  const second = await parcel(meridian, id, { deliveredAt: '2026-10-20 09:00:00' });
  const two = await service.create(actor(meridian), body(id, '2026-10-01', '2026-10-31'));
  assert.deepEqual(two.items.map((item) => item.parcelId), [second]);
  assert.notEqual(two.invoiceNumber, one.invoiceNumber);
});

test('two requests at the same moment bill each parcel once', async () => {
  const id = await merchant(meridian);
  await parcel(meridian, id);
  await parcel(meridian, id);
  const results = await Promise.allSettled([service.create(actor(meridian), body(id)), service.create(actor(meridian), body(id))]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const failed = results.find((result) => result.status === 'rejected');
  assert.equal(failed.reason.getResponse().code, 'INVOICE_NOTHING_TO_BILL');
  assert.equal((await database.query('SELECT COUNT(*) AS n FROM invoices WHERE client_id = ?', [id]))[0].n, '1');
});

test('a merchant of another company, or one that does not exist, is not found and nothing is stored', async () => {
  const foreign = await merchant(harbor);
  await parcel(harbor, foreign);
  const before = await auditCount();
  assert.equal((await refused(service.create(actor(meridian), body(foreign)))).code, 'INVOICE_MERCHANT_NOT_FOUND');
  assert.equal((await refused(service.create(actor(meridian), body('999999999')))).code, 'INVOICE_MERCHANT_NOT_FOUND');
  assert.equal((await database.query('SELECT COUNT(*) AS n FROM invoices WHERE client_id = ?', [foreign]))[0].n, '0');
  assert.equal(await auditCount(), before);
});

test('a company only bills its own parcels, even for a merchant it owns', async () => {
  const id = await merchant(meridian);
  const own = await parcel(meridian, id);
  await parcel(harbor, id);
  const view = await service.create(actor(meridian), body(id));
  assert.deepEqual(view.items.map((item) => item.parcelId), [own]);
});

test('a period that ends before it starts is refused', async () => {
  const id = await merchant(meridian);
  await parcel(meridian, id);
  assert.equal((await refused(service.create(actor(meridian), body(id, '2026-10-31', '2026-10-01')))).code, 'INVOICE_BAD_PERIOD');
});

test('a failure while saving the lines leaves no invoice behind', async () => {
  const id = await merchant(meridian);
  const taken = await parcel(meridian, id);
  const real = service.invoices.insertItems;
  service.invoices.insertItems = async () => { throw new Error('lines failed'); };
  try {
    assert.equal((await refused(service.create(actor(meridian), body(id)))).thrown, 'lines failed');
  } finally {
    service.invoices.insertItems = real;
  }
  assert.equal((await database.query('SELECT COUNT(*) AS n FROM invoices WHERE client_id = ?', [id]))[0].n, '0');
  assert.equal((await service.create(actor(meridian), body(id))).items[0].parcelId, taken);
});

test('a lost create response is recovered without changing the draft, ledger or audit', async () => {
  const id = await merchant(meridian);
  const parcelId = await parcel(meridian, id, { fee: '7.25' });
  const original = await service.create(actor(meridian), { ...body(id), notes: 'Saved snapshot' });
  const counts = async () => (await database.query(
    'SELECT (SELECT COUNT(*) FROM invoices WHERE client_id = ?) AS invoices, (SELECT COUNT(*) FROM merchant_ledger_entries WHERE client_id = ?) AS ledger, (SELECT COUNT(*) FROM audit_logs WHERE resource_type = ? AND record_id = ?) AS audit',
    [id, id, 'invoice', original.id],
  ))[0];
  const before = await counts();
  assert.equal((await refused(service.create(actor(meridian), body(id)))).code, 'INVOICE_NOTHING_TO_BILL');
  await database.query("UPDATE parcels SET delivery_fee = '99.00' WHERE id = ?", [parcelId]);
  const page = await service.list(actor(meridian).tenant, { ...body(id), page: 1, pageSize: 10 });
  assert.equal(page.total, 1);
  assert.equal(page.items[0].id, original.id);
  assert.deepEqual(await service.detail(actor(meridian).tenant, page.items[0].id), original);
  assert.equal((await service.detail(actor(meridian).tenant, original.id)).items[0].deliveryFee, '7.25');
  assert.deepEqual(await counts(), before);
});

test('invoice list filters exact periods, pages newest first and stays within the company', async () => {
  const id = await merchant(meridian);
  const created = [];
  for (let i = 0; i < 12; i++) {
    await parcel(meridian, id);
    created.push(await service.create(actor(meridian), body(id)));
  }
  await parcel(meridian, id, { deliveredAt: '2026-11-15 10:00:00' });
  const november = await service.create(actor(meridian), body(id, '2026-11-01', '2026-11-30'));
  const query = { ...body(id), page: 1, pageSize: 10 };
  const first = await service.list(actor(meridian).tenant, query);
  const second = await service.list(actor(meridian).tenant, { ...query, page: 2 });
  assert.equal(first.total, 12);
  assert.equal(second.total, 12);
  assert.deepEqual([...first.items, ...second.items].map((item) => item.id), created.map((item) => item.id).reverse());
  assert.equal((await service.list(actor(meridian).tenant, { ...query, periodStart: '2026-11-01', periodEnd: undefined })).items[0].id, november.id);
  assert.equal((await service.list(actor(harbor).tenant, query)).total, 0);
  for (const invoiceId of [created[0].id, '999999999', 'abc', '0']) {
    assert.equal((await refused(service.detail(actor(harbor).tenant, invoiceId))).code, 'INVOICE_NOT_FOUND');
  }
});
