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
