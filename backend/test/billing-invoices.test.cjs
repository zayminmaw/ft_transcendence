require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { InvoicesController } = require('../dist/modules/billing/invoices.controller');
const { CreateInvoiceDto } = require('../dist/modules/billing/dto/create-invoice.dto');
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
