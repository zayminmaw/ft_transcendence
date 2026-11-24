require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { CodController } = require('../dist/modules/billing/cod.controller');
const { ReconcileCodDto } = require('../dist/modules/billing/dto/reconcile-cod.dto');
const { REQUIRED_PERMISSION } = require('../dist/common/decorators/require-permission.decorator');
const { ConflictException } = require('@nestjs/common');
const { CodService } = require('../dist/modules/billing/cod.service');
const { COD_PARCELS_NOT_ELIGIBLE } = require('../dist/modules/billing/constants');

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

function recordedHandover(path) {
  const manager = {};
  let writes = 0;
  const stored = {
    id: '20', driverId: '15', totalCodExpected: '150.00', totalCashDropped: '150.00',
    discrepancyAmount: '0.00', settlementStatus: 'verified', settledAt: new Date('2026-11-15T10:00:00Z'),
  };
  const write = async () => { writes++; throw new Error('A retry must not write'); };
  const repository = {
    inTransaction: async (work) => {
      if (path === 'duplicate') throw Object.assign(new Error('reference collision'), { code: 'ER_DUP_ENTRY' });
      if (path === 'ineligible') throw new ConflictException(COD_PARCELS_NOT_ELIGIBLE);
      return work(manager);
    },
    findSettlement: async (transaction, organizationId, reference) => {
      assert.equal(transaction, path === 'existing' ? manager : null);
      assert.deepEqual([organizationId, reference], ['1', '1-DAY-2026-11-15']);
      return stored;
    },
    settledParcels: async (transaction, id) => {
      assert.equal(transaction, path === 'existing' ? manager : null);
      assert.equal(id, stored.id);
      return [{ id: '1', trackingNumber: 'TRC-FIRST', codAmount: '100.00' }, { id: '2', trackingNumber: 'TRC-SECOND', codAmount: '50.00' }];
    },
    insertSettlement: write, insertCollection: write,
  };
  const service = new CodService(repository, { post: write }, { record: write });
  return { reconcile: (body) => service.reconcile({ tenant: { organizationId: '1' }, userId: '7', meta: {} }, body), writes: () => writes };
}

for (const path of ['existing', 'duplicate', 'ineligible']) {
  test(`${path} reference lookup accepts identical and reordered retries without writing`, async () => {
    const handover = recordedHandover(path);
    for (const request of [good, { ...good, parcelIds: ['2', '1'], totalCashDropped: '0000150.00' }]) {
      const response = await handover.reconcile(request);
      assert.deepEqual([response.id, response.repeated, response.totalCashDropped], ['20', true, '150.00']);
      assert.deepEqual(response.parcels.map((parcel) => parcel.id), ['1', '2']);
    }
    assert.equal(handover.writes(), 0);
  });

  test(`${path} reference lookup refuses a different driver, cash amount or parcel set`, async () => {
    const handover = recordedHandover(path);
    for (const change of [
      { driverId: '16' }, { totalCashDropped: '149.99' }, { totalCashDropped: '150.01' },
      { parcelIds: ['1', '3'] }, { parcelIds: ['1'] }, { parcelIds: ['1', '2', '3'] }, { parcelIds: ['1', '1'] },
    ]) {
      await assert.rejects(handover.reconcile({ ...good, ...change }), (error) => {
        assert.equal(error.getStatus(), 409);
        assert.equal(error.getResponse().code, 'COD_REFERENCE_REUSED');
        return true;
      });
    }
    assert.equal(handover.writes(), 0);
  });
}
