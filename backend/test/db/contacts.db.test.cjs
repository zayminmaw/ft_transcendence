const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');
const { User } = require('../../dist/modules/users/entities/user.entity');
const { Contact } = require('../../dist/modules/contacts/entities/contact.entity');
const { ContactsRepository } = require('../../dist/modules/contacts/contacts.repository');

const TENANT_ROLES = ['org_admin', 'dispatcher', 'hub_sorter', 'finance', 'hr_manager', 'fleet_lead', 'driver'];

let database;
let north;
let south;
let dana;
let omar;
let layla;
let outsider;
// Membership ids: Dana, Omar and Layla in North, the outsider in South.
let danaMember;
let omarMember;
let laylaMember;
let outsiderMember;

before(async () => {
  database = await createTestDatabase();
  const company = (slug) => database.getRepository(Organization).save({ name: `${slug} company`, slug, contactEmail: `ops@${slug}.db.test` });
  north = String((await company('north')).id);
  south = String((await company('south')).id);
  const person = async (username) => String((await database.getRepository(User).save({ username, email: `${username}@db.test`, passwordHash: 'placeholder-hash' })).id);
  [dana, omar, layla, outsider] = await Promise.all(['dana.c', 'omar.c', 'layla.c', 'sam.c'].map(person));
  const [{ id: roleId }] = await database.query("SELECT id FROM roles WHERE code = 'dispatcher'");
  const join = async (organizationId, userId) => String((await database.query(
    'INSERT INTO organization_members (organization_id, user_id, role_id) VALUES (?, ?, ?)', [organizationId, userId, roleId],
  )).insertId);
  danaMember = await join(north, dana);
  omarMember = await join(north, omar);
  laylaMember = await join(north, layla);
  outsiderMember = await join(south, outsider);
});
after(() => database?.destroy());

const addContact = (organizationId, ownerMember, contactMember) => database.query(
  'INSERT INTO contacts (organization_id, owner_member_id, contact_member_id) VALUES (?, ?, ?)', [organizationId, ownerMember, contactMember],
);
const countContacts = async (ownerMember) => Number((await database.query('SELECT COUNT(*) AS n FROM contacts WHERE owner_member_id = ?', [ownerMember]))[0].n);

test('a contact links two memberships of one company, once, never to itself, and goes with its membership', async () => {
  await addContact(north, danaMember, omarMember);
  assert.equal(await countContacts(danaMember), 1);
  // The same pair again.
  await assert.rejects(addContact(north, danaMember, omarMember), /Duplicate/);
  // Yourself.
  await assert.rejects(addContact(north, danaMember, danaMember), /constraint|CONSTRAINT/i);
  // Someone from another company, whichever company the row names.
  await assert.rejects(addContact(north, danaMember, outsiderMember), /foreign key/i);
  await assert.rejects(addContact(south, danaMember, outsiderMember), /foreign key/i);
  // The same pair the other way round is a different contact.
  await addContact(north, omarMember, danaMember);
  // Leaving the company takes the contact, and the contacts that point at the person, with it.
  await addContact(north, danaMember, laylaMember);
  await database.query('DELETE FROM organization_members WHERE id = ?', [laylaMember]);
  assert.equal(await countContacts(danaMember), 1);
  await database.query('DELETE FROM organization_members WHERE id = ?', [omarMember]);
  assert.equal(await countContacts(danaMember), 0);
});

test('every tenant role holds contacts.manage_own and platform_admin does not', async () => {
  const holders = await database.query(
    `SELECT r.code, rp.scope FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       JOIN permissions p ON p.id = rp.permission_id
      WHERE p.code = 'contacts.manage_own' ORDER BY r.code`,
  );
  assert.deepEqual(holders.map(({ code }) => code), [...TENANT_ROLES].sort());
  assert.ok(holders.every(({ scope }) => scope === 'all'));
  const [permission] = await database.query("SELECT module FROM permissions WHERE code = 'contacts.manage_own'");
  assert.equal(permission.module, 'contacts');
});

// The queries. Their own people and companies, so the tests above cannot change what these see.
async function world(tag) {
  const company = (slug) => database.getRepository(Organization).save({ name: `${slug} company`, slug: `${slug}-${tag}`, contactEmail: `ops@${slug}-${tag}.db.test` });
  const [one, two] = [String((await company('one')).id), String((await company('two')).id)];
  const roles = Object.fromEntries((await database.query('SELECT id, code FROM roles')).map((row) => [row.code, row.id]));
  const people = {};
  const join = async (organizationId, name, role, { active = true, accountActive = true } = {}) => {
    people[name] ??= String((await database.getRepository(User).save({ username: `${name}.${tag}`, email: `${name}.${tag}@db.test`, passwordHash: 'placeholder-hash', isActive: accountActive })).id);
    await database.query('INSERT INTO organization_members (organization_id, user_id, role_id, is_active) VALUES (?, ?, ?, ?)', [organizationId, people[name], roles[role], active]);
  };
  return { one, two, people, join, repository: new ContactsRepository(database.getRepository(Contact)) };
}
const noAudit = async () => {};

test("the lists show only this owner's contacts of this company, with their role and whether they are active", async () => {
  const { one, two, people, join, repository } = await world('list');
  await join(one, 'ana', 'dispatcher');
  await join(one, 'ben', 'driver');
  await join(one, 'cal', 'finance', { active: false });
  await join(one, 'dee', 'driver', { accountActive: false });
  await join(one, 'eli', 'driver');
  await join(two, 'ana', 'driver');
  await join(two, 'ben', 'driver');
  for (const name of ['ben', 'cal', 'dee']) assert.equal(await repository.add(one, people.ana, people[name], noAudit), true);
  // Someone else's contact, and the same two people saved in the other company.
  assert.equal(await repository.add(one, people.eli, people.ben, noAudit), true);
  assert.equal(await repository.add(two, people.ana, people.ben, noAudit), true);

  const rows = await repository.list(one, people.ana);
  // Sorted by role name, then username: Driver (ben, dee), then Finance (cal).
  assert.deepEqual(rows.map((row) => row.username), ['ben.list', 'dee.list', 'cal.list']);
  assert.deepEqual(rows[0], { userId: people.ben, username: 'ben.list', displayName: null, role: { code: 'driver', name: rows[0].role.name }, accountActive: true, memberActive: true });
  assert.deepEqual(rows.map((row) => [row.accountActive, row.memberActive]), [[true, true], [false, true], [true, false]]);
  assert.deepEqual((await repository.list(two, people.ana)).map((row) => row.username), ['ben.list']);
  assert.deepEqual(await repository.list(one, people.ben), []);
});

test('candidates leave out yourself, people already saved, and anyone inactive', async () => {
  const { one, two, people, join, repository } = await world('cand');
  for (const name of ['ana', 'ben', 'cal', 'dee', 'eli']) await join(one, name, 'dispatcher', name === 'dee' ? { active: false } : name === 'eli' ? { accountActive: false } : {});
  await join(two, 'fay', 'dispatcher');
  await repository.add(one, people.ana, people.ben, noAudit);
  assert.deepEqual((await repository.candidates(one, people.ana)).map((row) => row.username), ['cal.cand']);
  // Another company's people are never offered, and ben still sees ana (saving is one way).
  assert.deepEqual((await repository.candidates(one, people.ben)).map((row) => row.username), ['ana.cand', 'cal.cand']);
  // findMember finds anyone with a row in the company, active or not, and nobody else.
  assert.equal((await repository.findMember(one, people.dee)).memberActive, false);
  assert.equal((await repository.findMember(one, people.eli)).accountActive, false);
  assert.equal(await repository.findMember(one, people.fay), null);
});

test('adding twice answers false and the audit callback runs once', async () => {
  const { one, people, join, repository } = await world('dup');
  await join(one, 'ana', 'dispatcher');
  await join(one, 'ben', 'dispatcher');
  let calls = 0;
  const alsoSave = async () => { calls += 1; };
  assert.equal(await repository.add(one, people.ana, people.ben, alsoSave), true);
  assert.equal(await repository.add(one, people.ana, people.ben, alsoSave), false);
  assert.equal(calls, 1);
  // When what is saved with it fails, the contact is not saved either.
  await assert.rejects(repository.add(one, people.ben, people.ana, async () => { throw new Error('audit down'); }), /audit down/);
  assert.deepEqual(await repository.list(one, people.ben), []);
});

test('removing runs the callback only when a row was removed', async () => {
  const { one, people, join, repository } = await world('rem');
  await join(one, 'ana', 'dispatcher');
  await join(one, 'ben', 'dispatcher');
  await repository.add(one, people.ana, people.ben, noAudit);
  let calls = 0;
  const alsoSave = async () => { calls += 1; };
  assert.equal(await repository.remove(one, people.ana, people.ben, alsoSave), true);
  assert.equal(await repository.remove(one, people.ana, people.ben, alsoSave), false);
  assert.equal(calls, 1);
  assert.deepEqual(await repository.list(one, people.ana), []);
});

test('viewersOf names the owners who saved someone, in that company only', async () => {
  const { one, two, people, join, repository } = await world('view');
  for (const name of ['ana', 'ben', 'cal']) await join(one, name, 'dispatcher', name === 'cal' ? { active: false } : {});
  await join(one, 'dee', 'dispatcher', { accountActive: false });
  for (const name of ['ana', 'ben', 'cal', 'dee']) await join(two, name, 'dispatcher');
  for (const owner of ['ana', 'cal', 'dee']) await repository.add(one, people[owner], people.ben, noAudit);
  await repository.add(two, people.ana, people.ben, noAudit);
  await repository.add(two, people.cal, people.ben, noAudit);
  // Only active owners are told, and only in the company asked about.
  assert.deepEqual(await repository.viewersOf(one, people.ben), [people.ana]);
  assert.deepEqual((await repository.viewersOf(two, people.ben)).sort(), [people.ana, people.cal].sort());
  assert.deepEqual(await repository.viewersOf(one, people.ana), []);
});
