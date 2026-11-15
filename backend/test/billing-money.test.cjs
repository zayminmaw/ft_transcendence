const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fromCents, toCents } = require('../dist/modules/billing/money');

test('amounts become whole cents and back without changing', () => {
  for (const value of ['0.00', '0.01', '12.50', '100.00', '-45.00', '-0.99', '9999999999.99', '-9999999999.99']) {
    assert.equal(fromCents(toCents(value)), value);
  }
  assert.equal(toCents('12.50'), 1250n);
  assert.equal(toCents('-0.05'), -5n);
});

test('sums that floating point gets wrong are exact in cents', () => {
  assert.equal(0.1 + 0.2 === 0.3, false);
  assert.equal(fromCents(toCents('0.10') + toCents('0.20')), '0.30');
  assert.equal(fromCents(toCents('100.00') - toCents('7.00') - toCents('3.50')), '89.50');
});

test('anything but digits with two decimals is refused', () => {
  for (const value of ['12.5', '12', '1e3', '', ' 1.00', '1.000', '--1.00', '+1.00', '1,00', 'abc', '12345678901.00']) {
    assert.throws(() => toCents(value), /is not an amount/);
  }
});

test('a result the column cannot hold is refused', () => {
  assert.equal(fromCents(999_999_999_999n), '9999999999.99');
  assert.throws(() => fromCents(1_000_000_000_000n), /more than a balance can hold/);
  assert.throws(() => fromCents(-1_000_000_000_000n), /more than a balance can hold/);
});
