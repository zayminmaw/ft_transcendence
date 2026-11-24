const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ParcelsRepository } = require('../dist/modules/parcels/parcels.repository');

// Exercise the combined delivery command without a database: both cash collection and proof must be accepted before
// it writes a status or history entry. The existing database tests cover locking and rollback.
function deliveryFixture({ collected = '120.00', codAmount = '120.00', driverId = '3', photo = '21', assignedOnly = false, owns = true } = {}) {
  const writes = [];
  let audits = 0;
  let parcel = {
    id: '7', status: 'out_for_delivery', codAmount, collectedAmount: null, driver: { id: '3' }, vehicle: { id: '4' }, run: { id: '5' },
    deliveredAt: null, deliveryLocation: null,
  };
  const query = {
    select: () => query, from: () => query, where: () => query, andWhere: () => query,
    getRawOne: async () => driverId === null ? undefined : ({ id: driverId }),
  };
  const manager = {
    createQueryBuilder: () => query,
    update: async (_entity, _where, values) => {
      writes.push({ kind: 'parcel', values });
      parcel = {
        ...parcel, status: values.lifecycleStatus, collectedAmount: values.collectedAmount, deliveredAt: new Date(),
        deliveryLocation: values.deliveredLatitude === null ? null : { latitude: values.deliveredLatitude, longitude: values.deliveredLongitude },
      };
    },
    insert: async (_entity, values) => { writes.push({ kind: 'event', values }); },
  };
  const repository = new ParcelsRepository({ transaction: async (_isolation, write) => write(manager) });
  repository.lock = async () => ({ status: parcel.status, proof: { signature: '20', photo, note: null } });
  repository.findOne = async () => parcel;
  repository.isAssignedTo = async () => owns;
  return {
    writes,
    auditCount: () => audits,
    deliver: () => repository.deliver('1', '7', '10', {
      collected, latitude: 31.95, longitude: 35.9, notes: 'Handed to recipient',
    }, async (_manager, before, after) => {
      assert.equal(before.collectedAmount, null);
      assert.equal(after.collectedAmount, collected);
      audits++;
    }, assignedOnly),
  };
}

for (const [name, options, refusal] of [
  ['cash does not match even with proof attached', { collected: '119.99' }, 'cod_mismatch'],
  ['proof is missing even with the exact cash', { photo: null }, 'proof_missing'],
  ['another linked driver attempts delivery', { driverId: '9' }, 'not_assigned_driver'],
  ['an assigned-only courier has no driver link', { driverId: null, assignedOnly: true, owns: false }, 'not_found'],
  ['an assigned-only courier was reassigned after the guard', { assignedOnly: true, owns: false }, 'not_found'],
  ['collection exceeds the cash due', { collected: '120.01' }, 'cod_mismatch'],
  ['collection is absent', { collected: null }, 'cod_mismatch'],
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
  assert.equal(result.parcel.collectedAmount, '120.00');
  assert.deepEqual(result.parcel.deliveryLocation, { latitude: '31.95000000', longitude: '35.90000000' });
  assert.deepEqual(fixture.writes.map(write => write.kind), ['parcel', 'event']);
  assert.deepEqual(fixture.writes[1].values, {
    parcelId: '7', actorUserId: '10', status: 'delivered', notes: 'Handed to recipient',
    driverId: '3', assetId: '4', dispatchRunId: '5',
  });
  assert.equal(fixture.auditCount(), 1);
});

test('a zero-COD delivery explicitly records zero collected', async () => {
  const fixture = deliveryFixture({ collected: '0.00', codAmount: '0.00', assignedOnly: true });
  assert.equal((await fixture.deliver()).parcel.collectedAmount, '0.00');
});

test('proof attachment and removal recheck assignment after locking, before any write', async () => {
  for (const fileId of ['42', null]) {
    let writes = 0;
    const manager = { update: async () => { writes++; } };
    const repository = new ParcelsRepository({ transaction: async (_level, callback) => callback(manager) });
    repository.lock = async () => ({ status: 'out_for_delivery', proof: { signature: null, photo: '41', note: null } });
    repository.isAssignedTo = async (organizationId, id, userId, transaction) => {
      assert.deepEqual([organizationId, id, userId, transaction], ['1', '7', '15', manager]);
      return false;
    };
    assert.deepEqual(await repository.attachProof('1', '7', 'photo', fileId, '15'), { status: 'not_found' });
    assert.equal(writes, 0);
  }
});
