const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ParcelsRepository } = require('../dist/modules/parcels/parcels.repository');

// Exercise the combined delivery command without a database: both cash collection and proof must be accepted before
// it writes a status or history entry. The existing database tests cover locking and rollback.
function deliveryFixture({ collected = '120.00', driverId = '3', photo = '21' } = {}) {
  const writes = [];
  let audits = 0;
  let parcel = {
    id: '7', status: 'out_for_delivery', codAmount: '120.00', driver: { id: '3' }, vehicle: { id: '4' }, run: { id: '5' },
    deliveredAt: null, deliveryLocation: null,
  };
  const query = {
    select: () => query, from: () => query, where: () => query, andWhere: () => query,
    getRawOne: async () => ({ id: driverId }),
  };
  const manager = {
    createQueryBuilder: () => query,
    update: async (_entity, _where, values) => {
      writes.push({ kind: 'parcel', values });
      parcel = {
        ...parcel, status: values.lifecycleStatus, deliveredAt: new Date(),
        deliveryLocation: values.deliveredLatitude === null ? null : { latitude: values.deliveredLatitude, longitude: values.deliveredLongitude },
      };
    },
    insert: async (_entity, values) => { writes.push({ kind: 'event', values }); },
  };
  const repository = new ParcelsRepository({ transaction: async (_isolation, write) => write(manager) });
  repository.lock = async () => ({ status: parcel.status, proof: { signature: '20', photo, note: null } });
  repository.findOne = async () => parcel;
  return {
    writes,
    auditCount: () => audits,
    deliver: () => repository.deliver('1', '7', '10', {
      collected, latitude: 31.95, longitude: 35.9, notes: 'Handed to recipient',
    }, async () => { audits++; }),
  };
}

for (const [name, options, refusal] of [
  ['cash does not match even with proof attached', { collected: '119.99' }, 'cod_mismatch'],
  ['proof is missing even with the exact cash', { photo: null }, 'proof_missing'],
  ['another linked driver attempts delivery', { driverId: '9' }, 'not_assigned_driver'],
]) {
  test(`delivery writes nothing when ${name}`, async () => {
    const fixture = deliveryFixture(options);
    assert.deepEqual(await fixture.deliver(), { status: refusal });
    assert.deepEqual(fixture.writes, []);
    assert.equal(fixture.auditCount(), 0);
  });
}

test('delivery keeps cash, ownership and proof checks together with location, history and audit', async () => {
  const fixture = deliveryFixture();
  const result = await fixture.deliver();
  assert.equal(result.status, 'updated');
  assert.equal(result.parcel.status, 'delivered');
  assert.deepEqual(result.parcel.deliveryLocation, { latitude: '31.95000000', longitude: '35.90000000' });
  assert.deepEqual(fixture.writes.map(write => write.kind), ['parcel', 'event']);
  assert.deepEqual(fixture.writes[1].values, {
    parcelId: '7', actorUserId: '10', status: 'delivered', notes: 'Handed to recipient',
    driverId: '3', assetId: '4', dispatchRunId: '5',
  });
  assert.equal(fixture.auditCount(), 1);
});
