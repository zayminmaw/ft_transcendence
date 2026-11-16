require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ActivityRecorder } = require('../dist/modules/insights/activity-recorder');

// A fake repository that records its calls, and a clock the test moves.
function setup({ failing = false } = {}) {
  const calls = [];
  const repository = {
    async markActive(...args) { calls.push(['markActive', ...args]); if (failing) throw new Error('database down'); },
    async addVisit(...args) { calls.push(['addVisit', ...args]); if (failing) throw new Error('database down'); },
    async purgeBefore(...args) { calls.push(['purgeBefore', ...args]); if (failing) throw new Error('database down'); return 0; },
  };
  const clock = { time: new Date('2026-11-08T10:00:00Z') };
  const recorder = new ActivityRecorder(repository, () => clock.time);
  return { calls, clock, recorder };
}
const writes = (calls, name) => calls.filter(([call]) => call === name);

test('two connects by the same member in a day make one write', async () => {
  const { calls, recorder } = setup();
  await recorder.markActive('1', '10');
  await recorder.markActive('1', '10');
  assert.deepEqual(writes(calls, 'markActive'), [['markActive', '1', '10', '2026-11-08']]);
});

test('another member or another company gets its own write', async () => {
  const { calls, recorder } = setup();
  await recorder.markActive('1', '10');
  await recorder.markActive('1', '11');
  await recorder.markActive('2', '10');
  assert.equal(writes(calls, 'markActive').length, 3);
});

test('two sockets connecting at once make one write', async () => {
  const { calls, recorder } = setup();
  await Promise.all([recorder.markActive('1', '10'), recorder.markActive('1', '10')]);
  assert.equal(writes(calls, 'markActive').length, 1);
});

test('a connect after UTC midnight writes the new day', async () => {
  const { calls, clock, recorder } = setup();
  clock.time = new Date('2026-11-08T23:59:59Z');
  await recorder.markActive('1', '10');
  clock.time = new Date('2026-11-09T00:00:01Z');
  await recorder.markActive('1', '10');
  assert.deepEqual(writes(calls, 'markActive'), [
    ['markActive', '1', '10', '2026-11-08'],
    ['markActive', '1', '10', '2026-11-09'],
  ]);
});

test('the first call of each UTC day deletes rows older than 90 days, once', async () => {
  const { calls, clock, recorder } = setup();
  await recorder.markActive('1', '10');
  await recorder.markActive('1', '11');
  assert.deepEqual(writes(calls, 'purgeBefore'), [['purgeBefore', '2026-08-10']]);
  clock.time = new Date('2026-11-09T00:00:01Z');
  await recorder.markActive('1', '10');
  assert.deepEqual(writes(calls, 'purgeBefore'), [['purgeBefore', '2026-08-10'], ['purgeBefore', '2026-08-11']]);
});

test('a failing repository never throws, and the write is tried again on the next connect', async () => {
  const { calls, recorder } = setup({ failing: true });
  await recorder.markActive('1', '10');
  await recorder.recordVisit('1', '10');
  await recorder.markActive('1', '10');
  assert.equal(writes(calls, 'markActive').length, 2);
});

test('recordVisit adds a visit for today in UTC', async () => {
  const { calls, clock, recorder } = setup();
  clock.time = new Date('2026-11-08T23:30:00Z');
  await recorder.recordVisit('1', '10');
  await recorder.recordVisit('1', '10');
  assert.deepEqual(writes(calls, 'addVisit'), [['addVisit', '1', '10', '2026-11-08'], ['addVisit', '1', '10', '2026-11-08']]);
});
