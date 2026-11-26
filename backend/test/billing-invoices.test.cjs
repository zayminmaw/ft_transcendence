require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { InvoicesController } = require('../dist/modules/billing/invoices.controller');
const { CreateInvoiceDto } = require('../dist/modules/billing/dto/create-invoice.dto');
const { InvoiceExportQueryDto, InvoiceQueryDto } = require('../dist/modules/billing/dto/invoice-query.dto');
const { InvoicesService } = require('../dist/modules/billing/invoices.service');
const { buildCsv, formatCsvCell } = require('../dist/modules/billing/csv');
const { BillingModule } = require('../dist/modules/billing/billing.module');
const { InvoicesRepository } = require('../dist/modules/billing/invoices.repository');
const { CodRepository } = require('../dist/modules/billing/cod.repository');
const { LedgerHistoryRepository } = require('../dist/modules/billing/ledger-history.repository');
const { PayoutsRepository } = require('../dist/modules/billing/payouts.repository');
const { AUDIT_RESOURCES } = require('../dist/modules/audit/audit-resources');
const { hashPassword } = require('../dist/modules/users/password');
const request = require('supertest');
const { PASSWORD, as, createAuthApp, createFakeStore, tokenFor } = require('./helpers/auth-app.cjs');
const { REQUIRED_PERMISSION } = require('../dist/common/decorators/require-permission.decorator');

const good = { clientId: '12', periodStart: '2026-10-01', periodEnd: '2026-10-31' };
const problems = async (values) => (await validate(plainToInstance(CreateInvoiceDto, values), { whitelist: true, forbidNonWhitelisted: true })).map((issue) => issue.property).sort();

test('the invoice route needs the create invoice permission, and export needs billing.export', () => {
  assert.equal(Reflect.getMetadata(REQUIRED_PERMISSION, InvoicesController), 'billing.create_invoice');
  assert.equal(Reflect.getMetadata(REQUIRED_PERMISSION, InvoicesController.prototype.create), undefined);
  assert.equal(Reflect.getMetadata(REQUIRED_PERMISSION, InvoicesController.prototype.issue), undefined);
  assert.equal(Reflect.getMetadata(REQUIRED_PERMISSION, InvoicesController.prototype.exportCsv), 'billing.export');
  assert.deepEqual(AUDIT_RESOURCES.invoice_export, { category: 'access', fields: {} });
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

test('invoice listing and export queries validate optional client, status, search, dates and paging', async () => {
  const check = async (values) => (await validate(plainToInstance(InvoiceQueryDto, values), { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property).sort();
  const checkExport = async (values) => (await validate(plainToInstance(InvoiceExportQueryDto, values), { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property).sort();

  assert.deepEqual([plainToInstance(InvoiceQueryDto, {}).page, plainToInstance(InvoiceQueryDto, {}).pageSize], [1, 10]);
  assert.deepEqual(await check({}), []);
  assert.deepEqual(await check({ clientId: '12', periodStart: '2026-10-01', periodEnd: '2026-10-31', status: 'issued', search: '  INV-1  ', page: '2', pageSize: '25' }), []);
  assert.equal(plainToInstance(InvoiceQueryDto, { search: '  INV-1  ' }).search, 'INV-1');
  assert.equal(plainToInstance(InvoiceQueryDto, { search: '   ' }).search, undefined);
  assert.deepEqual(await checkExport({ status: 'draft', search: 'Acme' }), []);
  assert.deepEqual(await checkExport({ page: '1' }), ['page']);

  for (const [change, field] of [
    [{ clientId: '0' }, 'clientId'],
    [{ periodStart: '2026-02-30' }, 'periodStart'],
    [{ periodEnd: '2026-10-01T00:00:00Z' }, 'periodEnd'],
    [{ status: 'unknown' }, 'status'],
    [{ search: 'a'.repeat(121) }, 'search'],
    [{ page: '0' }, 'page'],
    [{ pageSize: '11' }, 'pageSize'],
    [{ extra: 'x' }, 'extra'],
  ]) {
    assert.deepEqual(await check({ clientId: '12', ...change }), [field]);
  }
  await assert.rejects(
    new InvoicesService({}, {}).list({ organizationId: '1' }, { clientId: '12', periodStart: '2026-11-01', periodEnd: '2026-10-01' }),
    (e) => e.getResponse().code === 'INVOICE_BAD_PERIOD',
  );
});

test('CSV encoder produces RFC-4180 output and neutralizes spreadsheet formula prefixes', () => {
  assert.equal(formatCsvCell('plain'), 'plain');
  assert.equal(formatCsvCell('Acme, "LLC"'), '"Acme, ""LLC"""');
  assert.equal(formatCsvCell('=HYPERLINK("http://evil")'), `"'=HYPERLINK(""http://evil"")"`);
  assert.equal(formatCsvCell('+1+2'), `'+1+2`);
  assert.equal(formatCsvCell('-cmd|calc'), `'-cmd|calc`);
  assert.equal(formatCsvCell('@SUM(A1:A2)'), `'@SUM(A1:A2)`);
  assert.equal(formatCsvCell('\t1+1'), `'\t1+1`);
  assert.equal(formatCsvCell('\r1+1'), `"'` + `\r1+1"`);
  assert.equal(formatCsvCell(null), '');
  assert.equal(buildCsv(['A', 'B'], [['12.50', '=1+1']]), "A,B\r\n12.50,'=1+1\r\n");
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
  const companyList = (await as(request(server).get('/api/billing/invoices'), creator).expect(200)).body;
  assert.deepEqual([companyList.total, companyList.page, companyList.pageSize], [0, 1, 10]);
  const list = (await as(request(server).get('/api/billing/invoices?clientId=12&periodStart=2026-10-01'), creator).expect(200)).body;
  assert.deepEqual([list.total, list.page, list.pageSize], [0, 1, 10]);
  assert.equal(calls[1][1], '1');
  assert.equal(calls[1][2].periodStart, '2026-10-01');
  for (const url of [
    '/api/billing/invoices?clientId=0',
    '/api/billing/invoices?clientId=12&periodEnd=2026-02-30',
    '/api/billing/invoices?status=invalid',
    '/api/billing/invoices?clientId=12&page=0',
    '/api/billing/invoices?clientId=12&pageSize=11',
    '/api/billing/invoices?clientId=12&periodStart=2026-11-01&periodEnd=2026-10-01',
  ]) {
    await as(request(server).get(url), creator).expect(400);
  }
  for (const id of ['abc', '3']) {
    assert.equal((await as(request(server).get(`/api/billing/invoices/${id}`), creator).expect(404)).body.code, 'INVOICE_NOT_FOUND');
  }
  assert.deepEqual(calls.filter((c) => c[0] === 'find'), [['find', '1', '3']]);
});

test('company-wide listing filters by tenant, status and search, and export enforces billing.export, neutralizes formulas and audits', async (t) => {
  const store = createFakeStore();
  const passwordHash = await hashPassword(PASSWORD);
  store.rolePermissions.set('1', new Set(['billing.create_invoice', 'billing.export']));
  store.rolePermissions.set('2', new Set(['billing.create_invoice']));
  for (const [id, username, orgId, roleId] of [
    ['10', 'finance1', '1', '1'],
    ['11', 'noexport', '1', '2'],
    ['12', 'finance2', '2', '1'],
  ]) {
    store.users.push({ id, username, email: `${username}@invoice.test`, passwordHash, isActive: true, lastLoginAt: null });
    store.memberships.push({ organizationId: orgId, userId: id, roleId, isActive: true });
  }

  const rows = [
    {
      id: '101', organizationId: '1', invoiceNumber: 'INV-1-000101', clientId: '20',
      clientName: '=CMD("calc"), Merchants', clientCode: 'MRC-1',
      billingPeriodStart: '2026-10-01', billingPeriodEnd: '2026-10-15', status: 'draft',
      issueDate: '2026-10-16', dueDate: '2026-10-30', totalDeliveries: 3,
      totalDeliveryFees: '15.50', totalCodCollected: '0.00', netAmountDue: '15.50',
      createdAt: new Date('2026-10-16T08:00:00.000Z'),
    },
    {
      id: '102', organizationId: '1', invoiceNumber: 'INV-1-000102', clientId: '21',
      clientName: 'Atlas Goods', clientCode: '+ATLAS',
      billingPeriodStart: '2026-10-01', billingPeriodEnd: '2026-10-31', status: 'issued',
      issueDate: '2026-11-01', dueDate: '2026-11-15', totalDeliveries: 5,
      totalDeliveryFees: '25.00', totalCodCollected: '0.00', netAmountDue: '25.00',
      createdAt: new Date('2026-11-01T09:00:00.000Z'),
    },
    {
      id: '201', organizationId: '2', invoiceNumber: 'INV-2-000201', clientId: '30',
      clientName: 'Harbor Secret', clientCode: 'HRB-1',
      billingPeriodStart: '2026-10-01', billingPeriodEnd: '2026-10-31', status: 'issued',
      issueDate: '2026-11-01', dueDate: '2026-11-15', totalDeliveries: 8,
      totalDeliveryFees: '99.99', totalCodCollected: '0.00', netAmountDue: '99.99',
      createdAt: new Date('2026-11-01T10:00:00.000Z'),
    },
  ];

  const filterRows = (orgId, query) => {
    const needle = query.search?.toLowerCase();
    return rows.filter((row) => row.organizationId === orgId
      && (!query.clientId || row.clientId === query.clientId)
      && (!query.status || row.status === query.status)
      && (!query.periodStart || row.billingPeriodStart === query.periodStart)
      && (!query.periodEnd || row.billingPeriodEnd === query.periodEnd)
      && (!needle || [row.invoiceNumber, row.clientName, row.clientCode].some((field) => field.toLowerCase().includes(needle))));
  };

  const repository = {
    list: async (orgId, query) => {
      const matched = filterRows(orgId, query);
      const start = (query.page - 1) * query.pageSize;
      return { items: matched.slice(start, start + query.pageSize), total: matched.length };
    },
    listForExport: async (orgId, query) => filterRows(orgId, query),
    summary: async (orgId, clientId) => {
      const scoped = rows.filter((row) => row.organizationId === orgId && (!clientId || row.clientId === clientId));
      const cents = scoped.reduce((sum, row) => {
        const [whole, frac] = row.totalDeliveryFees.split('.');
        return sum + BigInt(whole) * 100n + BigInt(frac);
      }, 0n);
      return {
        total: scoped.length,
        draft: scoped.filter((r) => r.status === 'draft').length,
        issued: scoped.filter((r) => r.status === 'issued').length,
        paid: scoped.filter((r) => r.status === 'paid_via_balance_offset' || r.status === 'paid_via_bank_transfer').length,
        overdue: scoped.filter((r) => r.status === 'overdue').length,
        totalDeliveryFees: `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`,
      };
    },
    find: async () => null,
    items: async () => [],
  };

  const { server } = await createAuthApp(t, store, {
    imports: [BillingModule],
    overrides: [[InvoicesRepository, repository], [CodRepository, {}], [LedgerHistoryRepository, {}], [PayoutsRepository, {}]],
  });

  const finance1 = await tokenFor(server, 'finance1');
  const noexport = await tokenFor(server, 'noexport');
  const finance2 = await tokenFor(server, 'finance2');

  // Company-wide list returns only tenant 1 invoices with merchant name/code and summary stats.
  const allOrg1 = (await as(request(server).get('/api/billing/invoices'), finance1, '1').expect(200)).body;
  assert.equal(allOrg1.total, 2);
  assert.deepEqual(allOrg1.items.map((item) => [item.id, item.clientName, item.clientCode]), [
    ['101', '=CMD("calc"), Merchants', 'MRC-1'],
    ['102', 'Atlas Goods', '+ATLAS'],
  ]);
  assert.deepEqual(allOrg1.summary, { total: 2, draft: 1, issued: 1, paid: 0, overdue: 0, totalDeliveryFees: '40.50' });

  // Filtering by status and search works strictly within the company.
  const issuedOnly = (await as(request(server).get('/api/billing/invoices?status=issued&search=Atlas'), finance1, '1').expect(200)).body;
  assert.deepEqual(issuedOnly.items.map((item) => item.id), ['102']);
  assert.equal((await as(request(server).get('/api/billing/invoices?search=Harbor'), finance1, '1').expect(200)).body.total, 0);

  // Cross-tenant isolation: tenant 2 only sees tenant 2 invoices; tenant 1 user cannot access tenant 2.
  const org2List = (await as(request(server).get('/api/billing/invoices'), finance2, '2').expect(200)).body;
  assert.deepEqual(org2List.items.map((item) => item.id), ['201']);
  await as(request(server).get('/api/billing/invoices'), finance1, '2').expect(403);

  // Export requires billing.export (403 without it).
  await as(request(server).get('/api/billing/invoices/export'), noexport, '1').expect(403);
  await as(request(server).get('/api/billing/invoices/export'), finance1, '2').expect(403);
  await as(request(server).get('/api/billing/invoices/export?periodStart=2026-11-01&periodEnd=2026-10-01'), finance1, '1').expect(400);

  // Export returns RFC-4180 CSV with formula-injection neutralization, exact decimal strings, tenant isolation, and audit entry.
  const exported = await as(request(server).get('/api/billing/invoices/export'), finance1, '1').expect(200);
  assert.match(exported.headers['content-type'], /^text\/csv;\s*charset=utf-8$/i);
  assert.equal(exported.headers['content-disposition'], 'attachment; filename="invoices-export.csv"');
  const lines = exported.text.split('\r\n');
  assert.equal(lines[0], 'Invoice Number,Merchant Code,Merchant Name,Period Start,Period End,Status,Issue Date,Due Date,Total Deliveries,Total Delivery Fees,Total COD Collected,Net Amount Due,Created At');
  assert.equal(lines[1], `INV-1-000101,MRC-1,"'=CMD(""calc""), Merchants",2026-10-01,2026-10-15,draft,2026-10-16,2026-10-30,3,15.50,0.00,15.50,2026-10-16T08:00:00.000Z`);
  assert.equal(lines[2], `INV-1-000102,'+ATLAS,Atlas Goods,2026-10-01,2026-10-31,issued,2026-11-01,2026-11-15,5,25.00,0.00,25.00,2026-11-01T09:00:00.000Z`);
  assert.equal(lines[3], '');
  assert.equal(exported.text.includes('Harbor Secret'), false);

  // Filtered export records filter params in audit log.
  const filteredExport = await as(request(server).get('/api/billing/invoices/export?status=issued&search=Atlas'), finance1, '1').expect(200);
  assert.equal(filteredExport.text.includes('INV-1-000102'), true);
  assert.equal(filteredExport.text.includes('INV-1-000101'), false);

  const exportAudits = store.auditEntries.filter((entry) => entry.resourceType === 'invoice_export');
  assert.equal(exportAudits.length, 2);
  assert.deepEqual(
    { module: exportAudits[0].module, action: exportAudits[0].action, resourceType: exportAudits[0].resourceType, organizationId: exportAudits[0].organizationId, actorId: exportAudits[0].actorId, params: exportAudits[0].params },
    { module: 'billing', action: 'read', resourceType: 'invoice_export', organizationId: '1', actorId: '10', params: { count: 2 } },
  );
  assert.deepEqual(exportAudits[1].params, { count: 1, status: 'issued', search: 'Atlas' });
});
