const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');
const { User } = require('../../dist/modules/users/entities/user.entity');
const { CompanyActivityDay } = require('../../dist/modules/insights/entities/company-activity-day.entity');
const { InsightsRepository } = require('../../dist/modules/insights/insights.repository');

let database;
let repository;
let north;
let south;
let dana;
let omar;

before(async () => {
  database = await createTestDatabase();
  repository = new InsightsRepository(database.getRepository(CompanyActivityDay));
  const company = (slug) => database.getRepository(Organization).save({ name: `${slug} company`, slug, contactEmail: `ops@${slug}.insights.test` });
  north = String((await company('north-insights')).id);
  south = String((await company('south-insights')).id);
  const person = async (username) => String((await database.getRepository(User).save({ username, email: `${username}@insights.test`, passwordHash: 'placeholder-hash' })).id);
  [dana, omar] = await Promise.all(['dana.i', 'omar.i'].map(person));
});
after(() => database?.destroy());

const rows = (organizationId, userId) => database.query(
  "SELECT DATE_FORMAT(day, '%Y-%m-%d') AS day, visits FROM company_activity_days WHERE organization_id = ? AND user_id = ? ORDER BY day",
  [organizationId, userId],
);

test('the table is keyed by company, member and day, and stores nothing else', async () => {
  const columns = (await database.query(
    "SELECT column_name AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'company_activity_days' ORDER BY ordinal_position",
  )).map(({ name }) => name);
  assert.deepEqual(columns, ['organization_id', 'user_id', 'day', 'visits']);
  await database.query("INSERT INTO company_activity_days (organization_id, user_id, day) VALUES (?, ?, '2026-11-01')", [north, dana]);
  await assert.rejects(
    database.query("INSERT INTO company_activity_days (organization_id, user_id, day) VALUES (?, ?, '2026-11-01')", [north, dana]),
    /Duplicate/,
  );
  await database.query('DELETE FROM company_activity_days WHERE organization_id = ?', [north]);
});

test('markActive makes one row with no visits and changes nothing when it already exists', async () => {
  await repository.markActive(north, dana, '2026-11-02');
  await repository.markActive(north, dana, '2026-11-02');
  assert.deepEqual(await rows(north, dana), [{ day: '2026-11-02', visits: 0 }]);
  await repository.markActive(north, dana, '2026-11-03');
  assert.deepEqual((await rows(north, dana)).map((row) => row.day), ['2026-11-02', '2026-11-03']);
});

test('addVisit creates the row with one visit, then adds one each time, and keeps a row markActive made', async () => {
  await repository.addVisit(north, omar, '2026-11-04');
  assert.deepEqual(await rows(north, omar), [{ day: '2026-11-04', visits: 1 }]);
  await repository.addVisit(north, omar, '2026-11-04');
  assert.deepEqual(await rows(north, omar), [{ day: '2026-11-04', visits: 2 }]);
  await repository.markActive(north, omar, '2026-11-04');
  assert.deepEqual(await rows(north, omar), [{ day: '2026-11-04', visits: 2 }]);
  await repository.markActive(north, omar, '2026-11-05');
  await repository.addVisit(north, omar, '2026-11-05');
  assert.deepEqual(await rows(north, omar), [{ day: '2026-11-04', visits: 2 }, { day: '2026-11-05', visits: 1 }]);
});

test('the same person in two companies has independent rows', async () => {
  await repository.addVisit(north, dana, '2026-11-06');
  await repository.addVisit(north, dana, '2026-11-06');
  await repository.markActive(south, dana, '2026-11-06');
  assert.deepEqual((await rows(north, dana)).find((row) => row.day === '2026-11-06'), { day: '2026-11-06', visits: 2 });
  assert.deepEqual(await rows(south, dana), [{ day: '2026-11-06', visits: 0 }]);
});

test('deleting a user or a company deletes its rows', async () => {
  const company = (await database.getRepository(Organization).save({ name: 'gone', slug: 'gone-insights', contactEmail: 'ops@gone.insights.test' })).id;
  const leaver = (await database.getRepository(User).save({ username: 'leaver.i', email: 'leaver.i@insights.test', passwordHash: 'placeholder-hash' })).id;
  await repository.addVisit(String(company), String(leaver), '2026-11-07');
  await repository.addVisit(south, String(leaver), '2026-11-07');
  await database.query('DELETE FROM users WHERE id = ?', [leaver]);
  assert.deepEqual(await rows(String(company), String(leaver)), []);
  assert.deepEqual(await rows(south, String(leaver)), []);
  await repository.addVisit(String(company), omar, '2026-11-07');
  await database.query('DELETE FROM organizations WHERE id = ?', [company]);
  assert.deepEqual(await rows(String(company), omar), []);
  // Other companies are untouched.
  assert.ok((await rows(north, omar)).length > 0);
});

test('purgeBefore removes only older days and says how many', async () => {
  await database.query('DELETE FROM company_activity_days');
  for (const day of ['2026-08-08', '2026-08-09', '2026-08-10', '2026-08-11']) await repository.markActive(north, dana, day);
  await repository.markActive(south, omar, '2026-08-01');
  assert.equal(await repository.purgeBefore('2026-08-10'), 3);
  assert.deepEqual((await rows(north, dana)).map((row) => row.day), ['2026-08-10', '2026-08-11']);
  assert.deepEqual(await rows(south, omar), []);
  assert.equal(await repository.purgeBefore('2026-08-10'), 0);
});

// ---- The counting queries (Task 3). Each test builds its own companies, so the earlier tests' rows never matter. ----
let counter = 0;
async function world() {
  counter += 1;
  const company = async (name) => String((await database.getRepository(Organization).save({ name: `${name} ${counter}`, slug: `${name}-${counter}-agg`, contactEmail: `ops@${name}${counter}.agg.test` })).id);
  const person = async (name, isActive = true) => String((await database.getRepository(User).save({ username: `${name}.${counter}.agg`, email: `${name}${counter}@agg.test`, passwordHash: 'placeholder-hash', isActive })).id);
  const [roleA, roleB] = await database.query('SELECT id, code, name FROM roles ORDER BY id LIMIT 2');
  const join = (organizationId, userId, role, isActive = true) => database.query(
    'INSERT INTO organization_members (organization_id, user_id, role_id, is_active) VALUES (?, ?, ?, ?)', [organizationId, userId, role.id, isActive ? 1 : 0],
  );
  const activity = (organizationId, userId, day, visits) => database.query(
    'INSERT INTO company_activity_days (organization_id, user_id, day, visits) VALUES (?, ?, ?, ?)', [organizationId, userId, day, visits],
  );
  return { company, person, roleA, roleB, join, activity };
}
const audit = (organizationId, { module, action, category = 'data', outcome = 'success', at, newValues = null }) => database.query(
  `INSERT INTO audit_logs (organization_id, module, action, resource_type, category, outcome, new_values, occurred_at, retain_until)
   VALUES (?, ?, ?, 'thing', ?, ?, ?, ?, '2026-01-01 00:00:00')`,
  [organizationId, module, action, category, outcome, newValues && JSON.stringify(newValues), at],
);

test('activity counts only current active members, with their current role, inside the range', async () => {
  const { company, person, roleA, roleB, join, activity } = await world();
  const a = await company('a');
  const b = await company('b');
  const [u1, u2, u3, u4, u5, u6, u7] = [await person('u1'), await person('u2'), await person('u3'), await person('u4'), await person('u5', false), await person('u6'), await person('u7')];
  await join(a, u1, roleA); await join(a, u2, roleA); await join(a, u3, roleB); await join(a, u4, roleA, false); await join(a, u5, roleA); await join(a, u7, roleA);
  // u6 had rows here but left the company: no membership row at all.
  await activity(a, u1, '2026-11-01', 2); await activity(a, u1, '2026-11-02', 1); await activity(a, u1, '2026-11-08', 9);
  await activity(a, u2, '2026-11-02', 3);
  await activity(a, u3, '2026-11-02', 1); await activity(a, u3, '2026-11-07', 4);
  for (const user of [u4, u5, u6]) await activity(a, user, '2026-11-02', 100);
  // The same person in another company never changes this company's numbers.
  await join(b, u1, roleB); await activity(b, u1, '2026-11-02', 50);

  const result = await repository.activity(a, '2026-11-01', '2026-11-07');
  assert.equal(result.hasHistory, true);
  assert.deepEqual(result.members, { active: 3, total: 4 });
  assert.equal(result.visits, 11);
  assert.deepEqual(result.activeByDay, [
    { day: '2026-11-01', members: 1 }, { day: '2026-11-02', members: 3 }, { day: '2026-11-03', members: 0 }, { day: '2026-11-04', members: 0 },
    { day: '2026-11-05', members: 0 }, { day: '2026-11-06', members: 0 }, { day: '2026-11-07', members: 1 },
  ]);
  for (const { members } of result.activeByDay) assert.ok(members <= result.members.active);
  assert.deepEqual(result.activeByRole, [
    { roleCode: roleA.code, roleName: roleA.name, members: 2 },
    { roleCode: roleB.code, roleName: roleB.name, members: 1 },
  ]);
});

test('a company with no activity rows gives zeros, a day for every day in the range, and no history', async () => {
  const { company, person, roleA, join } = await world();
  const empty = await company('empty');
  await join(empty, await person('solo'), roleA);
  const result = await repository.activity(empty, '2026-11-01', '2026-11-03');
  assert.equal(result.hasHistory, false);
  assert.deepEqual(result.members, { active: 0, total: 1 });
  assert.equal(result.visits, 0);
  assert.deepEqual(result.activeByDay, [{ day: '2026-11-01', members: 0 }, { day: '2026-11-02', members: 0 }, { day: '2026-11-03', members: 0 }]);
  assert.deepEqual(result.activeByRole, []);
});

test('history exists as soon as the company has any row, even outside the range', async () => {
  const { company, person, roleA, join, activity } = await world();
  const early = await company('early');
  const user = await person('early');
  await join(early, user, roleA);
  await activity(early, user, '2026-08-01', 1);
  const result = await repository.activity(early, '2026-11-01', '2026-11-07');
  assert.equal(result.hasHistory, true);
  assert.equal(result.members.active, 0);
});

test('changes count business-data creates, updates and deletes in this company inside the UTC range, by module', async () => {
  const { company } = await world();
  const a = await company('chg-a');
  const b = await company('chg-b');
  const day = (n) => `2026-11-0${n} 12:00:00`;
  for (const action of ['create', 'create']) await audit(a, { module: 'clients', action, at: day(2) });
  await audit(a, { module: 'clients', action: 'update', at: day(3) });
  await audit(a, { module: 'contacts', action: 'delete', at: day(4) });
  // Left out: modules with their own cards or no business data, reads, failures, other companies, other days.
  for (const module of ['members', 'auth', 'audit', 'insights']) await audit(a, { module, action: 'create', at: day(2) });
  for (let i = 0; i < 3; i += 1) await audit(a, { module: 'clients', action: 'read', at: day(2) });
  await audit(a, { module: 'clients', action: 'create', outcome: 'failure', at: day(2) });
  await audit(a, { module: 'clients', action: 'create', category: 'platform', at: day(2) });
  await audit(a, { module: 'clients', action: 'create', at: '2026-11-08 00:00:00' });
  await audit(a, { module: 'clients', action: 'create', at: '2026-10-31 23:59:59' });
  for (let i = 0; i < 5; i += 1) await audit(b, { module: 'clients', action: 'create', at: day(2) });

  const { changes } = await repository.changes(a, '2026-11-01', '2026-11-07');
  assert.equal(changes.total, 4);
  assert.deepEqual(changes.byModule, [{ module: 'clients', count: 3 }, { module: 'contacts', count: 1 }]);
});

test('changes by module is ordered by count, capped at six, and the total still counts every module', async () => {
  const { company } = await world();
  const many = await company('many');
  for (let module = 1; module <= 8; module += 1) {
    for (let i = 0; i < 9 - module; i += 1) await audit(many, { module: `mod${module}`, action: 'update', at: '2026-11-02 12:00:00' });
  }
  const { changes } = await repository.changes(many, '2026-11-01', '2026-11-07');
  assert.equal(changes.total, 36);
  assert.deepEqual(changes.byModule, [8, 7, 6, 5, 4, 3].map((count, index) => ({ module: `mod${index + 1}`, count })));
});

test('the security counts read the members and access rows of this company only', async () => {
  const { company } = await world();
  const a = await company('sec-a');
  const b = await company('sec-b');
  const at = '2026-11-03 09:00:00';
  const seed = async (organizationId, scale) => {
    for (let i = 0; i < 2 * scale; i += 1) await audit(organizationId, { module: 'members', action: 'password_reset', category: 'security', at });
    for (let i = 0; i < 2 * scale; i += 1) await audit(organizationId, { module: 'members', action: 'status_change', at, newValues: { isActive: false } });
    for (let i = 0; i < scale; i += 1) await audit(organizationId, { module: 'members', action: 'status_change', at, newValues: { isActive: true } });
    for (let i = 0; i < 3 * scale; i += 1) await audit(organizationId, { module: 'members', action: 'update', at, newValues: { role: 'dispatcher' } });
    for (let i = 0; i < 2 * scale; i += 1) await audit(organizationId, { module: 'audit', action: 'read', category: 'access', outcome: 'denied', at });
    for (let i = 0; i < scale; i += 1) await audit(organizationId, { module: 'insights', action: 'read', category: 'access', outcome: 'denied', at });
  };
  await seed(a, 1);
  await seed(b, 10);
  // Not counted here: a role-less update, an allowed read, a denial in another module, a reset outside the range.
  await audit(a, { module: 'members', action: 'update', at, newValues: {} });
  await audit(a, { module: 'audit', action: 'read', category: 'access', at });
  await audit(a, { module: 'clients', action: 'read', category: 'access', outcome: 'denied', at });
  await audit(a, { module: 'members', action: 'password_reset', category: 'security', at: '2026-11-09 09:00:00' });

  const { security } = await repository.changes(a, '2026-11-01', '2026-11-07');
  assert.deepEqual(security, { passwordResets: 2, accountsSwitchedOff: 2, roleChanges: 3, deniedAttempts: 3 });
});

test('days are UTC dates whatever time zone the database session uses', async () => {
  const { company, person, roleA, join, activity } = await world();
  const zone = await company('zone');
  const user = await person('zone');
  await join(zone, user, roleA);
  await activity(zone, user, '2026-11-07', 1);
  await audit(zone, { module: 'clients', action: 'create', at: '2026-11-07 23:30:00' });
  const runner = database.createQueryRunner();
  try {
    await runner.query("SET time_zone = '+10:00'");
    const pinned = new InsightsRepository(runner.manager.getRepository(CompanyActivityDay));
    assert.equal((await pinned.changes(zone, '2026-11-07', '2026-11-07')).changes.total, 1);
    assert.equal((await pinned.changes(zone, '2026-11-08', '2026-11-08')).changes.total, 0);
    assert.deepEqual((await pinned.activity(zone, '2026-11-07', '2026-11-07')).activeByDay, [{ day: '2026-11-07', members: 1 }]);
  } finally {
    await runner.release();
  }
});
