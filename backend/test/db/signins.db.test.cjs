const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { AuditLog } = require('../../dist/modules/audit/entities/audit-log.entity');
const { SigninsRepository } = require('../../dist/modules/platform/signins.repository');
const { User } = require('../../dist/modules/users/entities/user.entity');

let database;
let signins;
let userId;
const retainUntil = new Date(Date.now() + 365 * 86_400_000);

// audit_logs is append-only, so every row is written with the time it should have.
const row = (action, at, overrides = {}) =>
  database.getRepository(AuditLog).insert({
    module: 'auth', action, resourceType: action === 'session_reuse' ? 'session' : 'user', userId,
    outcome: action === 'login_failed' ? 'failure' : 'success', occurredAt: new Date(at), createdAt: new Date(at), retainUntil, ...overrides,
  });

before(async () => {
  database = await createTestDatabase();
  signins = new SigninsRepository(database);
  userId = (await database.getRepository(User).save({ username: 'signins.user', email: 'signins@db.test', passwordHash: 'placeholder-hash' })).id;

  // The two sides of a UTC midnight.
  await row('login', '2026-11-05T23:59:59.999Z');
  await row('login', '2026-11-06T00:00:00.000Z');
  // Failed attempts, one against an account that does not exist (no user).
  await row('login_failed', '2026-11-06T10:00:00.000Z');
  await row('login_failed', '2026-11-06T11:00:00.000Z', { userId: null });
  await row('session_reuse', '2026-11-07T09:00:00.000Z');
  // Outside the range, on both sides.
  await row('login', '2026-11-04T23:59:59.999Z');
  await row('login', '2026-11-08T00:00:00.000Z');
  // Not counted: another action of the same module, and another module with the same action.
  await row('logout', '2026-11-06T12:00:00.000Z');
  await row('login', '2026-11-06T12:00:00.000Z', { module: 'members' });
});
after(() => database?.destroy());

test('counts sign-ins, failures and session reuse for each UTC day that has any', async () => {
  assert.deepEqual(await signins.countByDay('2026-11-05', '2026-11-07'), [
    { day: '2026-11-05', signIns: 1, failedSignIns: 0, sessionReuse: 0 },
    { day: '2026-11-06', signIns: 1, failedSignIns: 2, sessionReuse: 0 },
    { day: '2026-11-07', signIns: 0, failedSignIns: 0, sessionReuse: 1 },
  ]);
});

test('a row at the last millisecond of a day and one at the first of the next land on different days', async () => {
  const days = await signins.countByDay('2026-11-05', '2026-11-06');
  assert.equal(days.find((entry) => entry.day === '2026-11-05').signIns, 1);
  assert.equal(days.find((entry) => entry.day === '2026-11-06').signIns, 1);
});

test('rows just before the first day or just after the last day are left out', async () => {
  const days = await signins.countByDay('2026-11-05', '2026-11-07');
  assert.equal(days.some((entry) => entry.day === '2026-11-04' || entry.day === '2026-11-08'), false);
});

test('a failed attempt with no account is counted', async () => {
  const [day] = await signins.countByDay('2026-11-06', '2026-11-06');
  assert.equal(day.failedSignIns, 2);
});

test('a range with nothing in it gives an empty list', async () => {
  assert.deepEqual(await signins.countByDay('2026-10-01', '2026-10-07'), []);
});
