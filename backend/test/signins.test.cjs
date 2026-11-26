const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SigninsService } = require('../dist/modules/platform/signins.service');

// A repository that records what it was asked and answers with the rows it was given. Today is 2026-11-08 (UTC).
function service(rows = []) {
  const calls = [];
  const repository = {
    countByDay: async (from, to) => {
      calls.push([from, to]);
      return rows;
    },
  };
  return { calls, service: new SigninsService(repository, () => new Date('2026-11-08T15:00:00Z')) };
}

test('a range of 7 days asks for today and the six days before it, in UTC', async () => {
  const { calls, service: signins } = service();
  const result = await signins.read(7);
  assert.deepEqual(calls, [['2026-11-02', '2026-11-08']]);
  assert.equal(result.range, 7);
  assert.equal(result.from, '2026-11-02');
  assert.equal(result.to, '2026-11-08');
});

test('30 and 90 days reach 29 and 89 days back from today', async () => {
  const thirty = service();
  await thirty.service.read(30);
  assert.deepEqual(thirty.calls, [['2026-10-10', '2026-11-08']]);
  const ninety = service();
  await ninety.service.read(90);
  assert.deepEqual(ninety.calls, [['2026-08-11', '2026-11-08']]);
});

test('every day of the range is in the answer, a day with no rows has zeros', async () => {
  const { service: signins } = service([{ day: '2026-11-07', signIns: 8, failedSignIns: 2, sessionReuse: 0 }]);
  const result = await signins.read(7);
  assert.deepEqual(result.days.map((entry) => entry.day), [
    '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
  ]);
  assert.deepEqual(result.days[0], { day: '2026-11-02', signIns: 0, failedSignIns: 0, sessionReuse: 0 });
  assert.deepEqual(result.days[5], { day: '2026-11-07', signIns: 8, failedSignIns: 2, sessionReuse: 0 });
});

test('the totals add up the days and the failure rate is failed attempts over all attempts, to one decimal', async () => {
  const { service: signins } = service([
    { day: '2026-11-07', signIns: 8, failedSignIns: 2, sessionReuse: 0 },
    { day: '2026-11-08', signIns: 2, failedSignIns: 0, sessionReuse: 1 },
  ]);
  const { totals } = await signins.read(7);
  assert.deepEqual(totals, { signIns: 10, failedSignIns: 2, failureRate: 16.7, sessionReuse: 1 });
});

test('with no attempts at all the failure rate is 0, a number', async () => {
  const { service: signins } = service();
  const { totals } = await signins.read(30);
  assert.deepEqual(totals, { signIns: 0, failedSignIns: 0, failureRate: 0, sessionReuse: 0 });
  assert.equal(Number.isFinite(totals.failureRate), true);
});

test('only failed attempts give a rate of 100', async () => {
  const { service: signins } = service([{ day: '2026-11-08', signIns: 0, failedSignIns: 3, sessionReuse: 0 }]);
  assert.equal((await signins.read(7)).totals.failureRate, 100);
});

test('the answer has exactly the documented keys, so nothing a repository adds later can leak', async () => {
  const { service: signins } = service([{ day: '2026-11-08', signIns: 1, failedSignIns: 0, sessionReuse: 0, username: 'lina', ip: '10.0.0.1' }]);
  const result = await signins.read(7);
  assert.deepEqual(Object.keys(result).sort(), ['days', 'from', 'range', 'to', 'totals']);
  assert.deepEqual(Object.keys(result.totals).sort(), ['failedSignIns', 'failureRate', 'sessionReuse', 'signIns']);
  for (const entry of result.days) assert.deepEqual(Object.keys(entry).sort(), ['day', 'failedSignIns', 'sessionReuse', 'signIns']);
});
