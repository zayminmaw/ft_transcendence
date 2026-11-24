require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { LedgerHistoryController } = require('../dist/modules/billing/ledger-history.controller');
const { LedgerHistoryService } = require('../dist/modules/billing/ledger-history.service');
const { LedgerHistoryQueryDto } = require('../dist/modules/billing/dto/ledger-history-query.dto');
const { REQUIRED_PERMISSION } = require('../dist/common/decorators/require-permission.decorator');

const tenant = { organizationId: '5', roleId: '1' };
const problems = async (values) => (await validate(plainToInstance(LedgerHistoryQueryDto, values))).map((issue) => issue.property).sort();
const row = (id) => ({
  id, entryType: 'credit', referenceType: 'cod_credit', referenceId: '7', amount: '10.00', balanceAfter: '10.00',
  description: 'COD', createdAt: new Date('2026-11-01T10:00:00.000Z'),
});
const service = (history) => new LedgerHistoryService(history);

test('reading a ledger needs the financials permission, the same as seeing balances', () => {
  assert.equal(Reflect.getMetadata(REQUIRED_PERMISSION, LedgerHistoryController), 'clients.view_financials');
});

test('paging defaults to the first page of 25, and refuses sizes and pages the lists do not offer', async () => {
  const query = plainToInstance(LedgerHistoryQueryDto, {});
  assert.deepEqual([query.page, query.pageSize], [1, 25]);
  assert.deepEqual(await problems({ page: '2', pageSize: '50' }), []);
  assert.deepEqual(await problems({ page: '0' }), ['page']);
  assert.deepEqual(await problems({ pageSize: '7' }), ['pageSize']);
});

test('a page of lines is passed through with ISO dates and its paging', async () => {
  const calls = [];
  const history = { clientExists: async () => true, page: async (...args) => (calls.push(args), { items: [row('9'), row('8')], total: 12 }) };
  const result = await service(history).page(tenant, '3', { page: 2, pageSize: 10 });
  assert.deepEqual(calls, [['5', '3', 2, 10]]);
  assert.equal(result.total, 12);
  assert.deepEqual([result.page, result.pageSize], [2, 10]);
  assert.equal(result.items[0].createdAt, '2026-11-01T10:00:00.000Z');
  assert.deepEqual(Object.keys(result.items[0]).sort(), ['amount', 'balanceAfter', 'createdAt', 'description', 'entryType', 'id', 'referenceId', 'referenceType']);
});

test('a merchant that is not in this company, or a malformed id, is a 404 and reads nothing', async () => {
  let read = false;
  const history = { clientExists: async () => false, page: async () => ((read = true), { items: [], total: 0 }) };
  for (const id of ['3', 'abc', '0']) {
    await assert.rejects(service(history).page(tenant, id, { page: 1, pageSize: 25 }), (error) => error.getStatus() === 404 && error.getResponse().code === 'LEDGER_CLIENT_NOT_FOUND');
  }
  assert.equal(read, false);
});
