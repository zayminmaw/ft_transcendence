require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { InvoicesController } = require('../dist/modules/billing/invoices.controller');
const { CreateInvoiceDto } = require('../dist/modules/billing/dto/create-invoice.dto');
const { InvoiceQueryDto } = require('../dist/modules/billing/dto/invoice-query.dto');
const { InvoicesService } = require('../dist/modules/billing/invoices.service');
const { BillingModule } = require('../dist/modules/billing/billing.module');
const { InvoicesRepository } = require('../dist/modules/billing/invoices.repository');
const { CodRepository } = require('../dist/modules/billing/cod.repository');
const { LedgerHistoryRepository } = require('../dist/modules/billing/ledger-history.repository');
const { PayoutsRepository } = require('../dist/modules/billing/payouts.repository');
const { hashPassword } = require('../dist/modules/users/password');
const request = require('supertest');
const { PASSWORD, as, createAuthApp, createFakeStore, tokenFor } = require('./helpers/auth-app.cjs');
const { REQUIRED_PERMISSION } = require('../dist/common/decorators/require-permission.decorator');

const good = { clientId: '12', periodStart: '2026-10-01', periodEnd: '2026-10-31' };
const problems = async (values) => (await validate(plainToInstance(CreateInvoiceDto, values), { whitelist: true, forbidNonWhitelisted: true })).map((issue) => issue.property).sort();

test('the invoice route needs the create invoice permission, and nothing weaker', () => {
  assert.equal(Reflect.getMetadata(REQUIRED_PERMISSION, InvoicesController), 'billing.create_invoice');
  assert.equal(Reflect.getMetadata(REQUIRED_PERMISSION, InvoicesController.prototype.create), undefined);
});

test('a well-formed request passes, with or without notes, and notes are trimmed', async () => {
  assert.deepEqual(await problems(good), []);
  assert.deepEqual(await problems({ ...good, notes: 'October fees' }), []);
  assert.equal(plainToInstance(CreateInvoiceDto, { ...good, notes: '  October fees  ' }).notes, 'October fees');
  assert.deepEqual(await problems({ ...good, periodStart: '2026-10-31', periodEnd: '2026-10-31' }), []);
});

test('each field refuses what it should', async () => {
  const bad = [
    [{ clientId: 'abc' }, ['clientId']], [{ clientId: '0' }, ['clientId']], [{ clientId: 12 }, ['clientId']],
    [{ periodStart: '2026-10' }, ['periodStart']], [{ periodStart: '10/01/2026' }, ['periodStart']], [{ periodStart: '2026-02-30' }, ['periodStart']],
    [{ periodStart: '2026-10-01T00:00:00Z' }, ['periodStart']], [{ periodEnd: '2026-13-01' }, ['periodEnd']], [{ periodEnd: 20261031 }, ['periodEnd']],
    [{ notes: 'x'.repeat(1001) }, ['notes']], [{ extra: 'field' }, ['extra']],
  ];
  for (const [change, expected] of bad) assert.deepEqual(await problems({ ...good, ...change }), expected, JSON.stringify(change).slice(0, 60));
  assert.deepEqual(await problems({}), ['clientId', 'periodEnd', 'periodStart']);
});

test('invoice recovery validates query dates, client and paging', async () => {
  const check = async (values) => (await validate(plainToInstance(InvoiceQueryDto, values), { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property).sort();
  assert.deepEqual([plainToInstance(InvoiceQueryDto, { clientId: '12' }).page, plainToInstance(InvoiceQueryDto, { clientId: '12' }).pageSize], [1, 10]);
  assert.deepEqual(await check({ clientId: '12', periodStart: '2026-10-01', periodEnd: '2026-10-31', page: '2', pageSize: '25' }), []);
  for (const [change, field] of [[{ clientId: '0' }, 'clientId'], [{ periodStart: '2026-02-30' }, 'periodStart'], [{ periodEnd: '2026-10-01T00:00:00Z' }, 'periodEnd'], [{ page: '0' }, 'page'], [{ pageSize: '11' }, 'pageSize'], [{ extra: 'x' }, 'extra']]) {
    assert.deepEqual(await check({ clientId: '12', ...change }), [field]);
  }
  assert.deepEqual(await check({}), ['clientId']);
  await assert.rejects(new InvoicesService({}, {}).list({ organizationId: '1' }, { clientId: '12', periodStart: '2026-11-01', periodEnd: '2026-10-01' }), (e) => e.getResponse().code === 'INVOICE_BAD_PERIOD');
});

test('recovery reads require creator permission, validate queries and pass the active company', async (t) => {
  const store = createFakeStore();
  const passwordHash = await hashPassword(PASSWORD);
  store.rolePermissions.set('1', new Set(['billing.create_invoice']));
  store.rolePermissions.set('2', new Set(['billing.view']));
  for (const [id, username, roleId] of [['10', 'creator', '1'], ['11', 'viewer', '2']]) {
    store.users.push({ id, username, email: `${username}@invoice.test`, passwordHash, isActive: true, lastLoginAt: null });
    store.memberships.push({ organizationId: '1', userId: id, roleId, isActive: true });
  }
  const calls = [];
  const repository = {
    list: async (org, query) => { calls.push(['list', org, query]); return { items: [], total: 0 }; },
    find: async (org, id) => { calls.push(['find', org, id]); return null; },
    items: async () => { throw new Error('must not read items for a missing invoice'); },
  };
  const { server } = await createAuthApp(t, store, { imports: [BillingModule], overrides: [[InvoicesRepository, repository], [CodRepository, {}], [LedgerHistoryRepository, {}], [PayoutsRepository, {}]] });
  const creator = await tokenFor(server, 'creator');
  const viewer = await tokenFor(server, 'viewer');
  await as(request(server).get('/api/billing/invoices?clientId=12'), viewer).expect(403);
  await as(request(server).get('/api/billing/invoices/3'), viewer).expect(403);
  const list = (await as(request(server).get('/api/billing/invoices?clientId=12&periodStart=2026-10-01'), creator).expect(200)).body;
  assert.deepEqual([list.total, list.page, list.pageSize], [0, 1, 10]);
  assert.equal(calls[0][1], '1');
  assert.equal(calls[0][2].periodStart, '2026-10-01');
  for (const url of ['/api/billing/invoices', '/api/billing/invoices?clientId=0', '/api/billing/invoices?clientId=12&periodEnd=2026-02-30', '/api/billing/invoices?clientId=12&page=0', '/api/billing/invoices?clientId=12&pageSize=11', '/api/billing/invoices?clientId=12&periodStart=2026-11-01&periodEnd=2026-10-01']) {
    await as(request(server).get(url), creator).expect(400);
  }
  for (const id of ['abc', '3']) {
    assert.equal((await as(request(server).get(`/api/billing/invoices/${id}`), creator).expect(404)).body.code, 'INVOICE_NOT_FOUND');
  }
  assert.deepEqual(calls.filter((c) => c[0] === 'find'), [['find', '1', '3']]);
});
