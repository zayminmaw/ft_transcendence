require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { PayoutsController } = require('../dist/modules/billing/payouts.controller');
const { CreatePayoutDto } = require('../dist/modules/billing/dto/create-payout.dto');
const { REQUIRED_PERMISSION } = require('../dist/common/decorators/require-permission.decorator');

const good = { clientId: '12', amount: '4650.00', wireReference: 'WIRE-20261031-9982' };
const problems = async (values) => (await validate(plainToInstance(CreatePayoutDto, values), { whitelist: true, forbidNonWhitelisted: true })).map((issue) => issue.property).sort();

test('the payout route needs the balance adjustment permission, and nothing weaker', () => {
  assert.equal(Reflect.getMetadata(REQUIRED_PERMISSION, PayoutsController), 'billing.adjust_balance');
  assert.equal(Reflect.getMetadata(REQUIRED_PERMISSION, PayoutsController.prototype.create), undefined);
});

test('a well-formed payout passes, and the reference is trimmed', async () => {
  assert.deepEqual(await problems(good), []);
  assert.equal(plainToInstance(CreatePayoutDto, { ...good, wireReference: '  WIRE-0001  ' }).wireReference, 'WIRE-0001');
});

test('each field refuses what it should', async () => {
  const bad = [
    [{ clientId: 'abc' }, ['clientId']], [{ clientId: '0' }, ['clientId']], [{ clientId: 12 }, ['clientId']],
    [{ amount: '4650' }, ['amount']], [{ amount: '4650.5' }, ['amount']], [{ amount: '4650.001' }, ['amount']], [{ amount: '0.00' }, ['amount']],
    [{ amount: '000.00' }, ['amount']], [{ amount: '-5.00' }, ['amount']], [{ amount: 4650 }, ['amount']], [{ amount: '12345678901.00' }, ['amount']],
    [{ wireReference: 'ab' }, ['wireReference']], [{ wireReference: 'has space' }, ['wireReference']], [{ wireReference: 'x'.repeat(41) }, ['wireReference']],
    [{ extra: 'field' }, ['extra']],
  ];
  for (const [change, expected] of bad) assert.deepEqual(await problems({ ...good, ...change }), expected, JSON.stringify(change).slice(0, 60));
  assert.deepEqual(await problems({}), ['amount', 'clientId', 'wireReference']);
  assert.deepEqual(await problems({ ...good, amount: '0.01' }), []);
});
