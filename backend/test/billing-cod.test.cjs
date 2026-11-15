require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { CodController } = require('../dist/modules/billing/cod.controller');
const { ReconcileCodDto } = require('../dist/modules/billing/dto/reconcile-cod.dto');
const { REQUIRED_PERMISSION } = require('../dist/common/decorators/require-permission.decorator');

const good = { driverId: '15', settlementReference: 'DAY-2026-11-15', totalCashDropped: '150.00', parcelIds: ['1', '2'] };
const problems = async (values) => (await validate(plainToInstance(ReconcileCodDto, values), { whitelist: true, forbidNonWhitelisted: true })).map((issue) => issue.property).sort();

test('both routes need the COD approval permission, and nothing weaker', () => {
  assert.equal(Reflect.getMetadata(REQUIRED_PERMISSION, CodController), 'billing.reconcile_cod');
  for (const handler of ['waiting', 'reconcile']) assert.equal(Reflect.getMetadata(REQUIRED_PERMISSION, CodController.prototype[handler]), undefined);
});

test('a well-formed handover passes, and the reference is trimmed', async () => {
  assert.deepEqual(await problems(good), []);
  const trimmed = plainToInstance(ReconcileCodDto, { ...good, settlementReference: '  DAY-0001  ' });
  assert.equal(trimmed.settlementReference, 'DAY-0001');
});

test('each field refuses what it should', async () => {
  const bad = [
    [{ driverId: 'abc' }, ['driverId']], [{ driverId: '0' }, ['driverId']], [{ driverId: 15 }, ['driverId']],
    [{ settlementReference: 'ab' }, ['settlementReference']], [{ settlementReference: 'has space' }, ['settlementReference']],
    [{ settlementReference: 'x'.repeat(41) }, ['settlementReference']],
    [{ totalCashDropped: '150' }, ['totalCashDropped']], [{ totalCashDropped: '150.5' }, ['totalCashDropped']],
    [{ totalCashDropped: '-1.00' }, ['totalCashDropped']], [{ totalCashDropped: 150 }, ['totalCashDropped']],
    [{ parcelIds: [] }, ['parcelIds']], [{ parcelIds: ['1', '1'] }, ['parcelIds']], [{ parcelIds: ['1', 'x'] }, ['parcelIds']],
    [{ parcelIds: Array.from({ length: 201 }, (_, i) => String(i + 1)) }, ['parcelIds']], [{ parcelIds: '1' }, ['parcelIds']],
    [{ extra: 'field' }, ['extra']],
  ];
  for (const [change, expected] of bad) assert.deepEqual(await problems({ ...good, ...change }), expected, JSON.stringify(change).slice(0, 60));
  assert.deepEqual(await problems({}), ['driverId', 'parcelIds', 'settlementReference', 'totalCashDropped']);
});
