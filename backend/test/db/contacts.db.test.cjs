const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');
const { User } = require('../../dist/modules/users/entities/user.entity');

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
