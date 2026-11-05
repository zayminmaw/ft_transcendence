const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { ContactsModule } = require('../dist/modules/contacts');
const { hashPassword } = require('../dist/modules/users/password');
const { PASSWORD, as, createAuthApp, createFakeStore, tokenFor } = require('./helpers/auth-app.cjs');

process.env.NODE_ENV = 'test';

const DRIVER = { code: 'driver', name: 'Courier / Driver' };
// Meridian (company 1) and Harbor (company 2). Dana is a dispatcher who works in both.
async function app(t) {
  const passwordHash = await hashPassword(PASSWORD);
  const store = createFakeStore();
  store.roles.push(
    { id: 1, code: 'org_admin', name: 'Organization Admin', description: 'Runs the company' },
    { id: 2, code: 'dispatcher', name: 'Dispatcher', description: 'Assigns parcels' },
    { id: 3, code: 'finance', name: 'Finance', description: 'Money' },
    { id: 4, code: 'driver', name: 'Courier / Driver', description: 'Delivers' },
    { id: 9, code: 'platform_admin', name: 'Platform Admin', description: 'Platform' },
  );
  for (const id of ['1', '2', '3', '4']) store.rolePermissions.set(id, new Set(['contacts.manage_own']));
  store.rolePermissions.set('9', new Set(['parcels.view']));
  const people = [
    // id, username, company, role, membership active, account active
    ['10', 'dana', '1', '2', true, true], ['11', 'omar', '1', '4', true, true], ['12', 'sam', '1', '3', true, true],
    ['13', 'noor', '1', '2', true, true], ['14', 'ivy', '1', '4', false, true], ['15', 'jon', '1', '4', true, false],
    ['16', 'zara.platform', '1', '9', true, true], ['17', 'lena', '1', '1', true, true], ['20', 'karim', '2', '2', true, true],
  ];
  for (const [id, username, organizationId, roleId, isActive, accountActive] of people) {
    store.users.push({ id, username, email: `${username}@demo.example.test`, passwordHash, isActive: accountActive, lastLoginAt: null });
    store.memberships.push({ organizationId, userId: id, roleId, isActive });
  }
  // Dana and Omar also work at Harbor.
  store.memberships.push({ organizationId: '2', userId: '10', roleId: '2', isActive: true }, { organizationId: '2', userId: '11', roleId: '4', isActive: true });
  return { store, ...(await createAuthApp(t, store, { imports: [ContactsModule] })) };
}
const save = (store, organizationId, ownerUserId, contactUserId) => store.contacts.push({ organizationId, ownerUserId, contactUserId });
const names = (response) => response.body.map((contact) => contact.username);

test('the list shows your contacts with role, username and status, only yours, only this company', async (t) => {
  const { server, store } = await app(t);
  save(store, '1', '10', '11');
  save(store, '1', '10', '12');
  save(store, '1', '13', '17');
  save(store, '2', '10', '11');
  const dana = await tokenFor(server, 'dana');
  const list = (await as(request(server).get('/api/contacts'), dana).expect(200)).body;
  // Sorted by role name: Courier / Driver, then Finance.
  assert.deepEqual(list, [
    { userId: '11', username: 'omar', displayName: null, role: DRIVER, status: 'offline' },
    { userId: '12', username: 'sam', displayName: null, role: { code: 'finance', name: 'Finance' }, status: 'offline' },
  ]);
  assert.deepEqual(names(await as(request(server).get('/api/contacts'), dana, '2').expect(200)), ['omar']);
});

test('a suspended contact stays in the list as Suspended and an active one shows Offline', async (t) => {
  const { server, store } = await app(t);
  for (const id of ['11', '14', '15']) save(store, '1', '10', id);
  const dana = await tokenFor(server, 'dana');
  const list = (await as(request(server).get('/api/contacts'), dana).expect(200)).body;
  // Ivy's membership and Jon's account are suspended; Omar is fine and nobody is connected yet.
  assert.deepEqual(list.map(({ username, status }) => [username, status]), [['ivy', 'suspended'], ['jon', 'suspended'], ['omar', 'offline']]);
});

test('candidates are the eligible, active, not yet saved colleagues of your role rules', async (t) => {
  const { server, store } = await app(t);
  const dana = await tokenFor(server, 'dana');
  // A dispatcher may add drivers and dispatchers, so not Sam (finance), Lena (admin), Zara (platform), Ivy and Jon
  // (suspended), Karim (other company) or herself.
  assert.deepEqual(names(await as(request(server).get('/api/contacts/candidates'), dana).expect(200)), ['omar', 'noor']);
  save(store, '1', '10', '11');
  assert.deepEqual(names(await as(request(server).get('/api/contacts/candidates'), dana).expect(200)), ['noor']);
});

test('adding follows the role rules, and a person from another company, an inactive person or a disallowed role gets the same CONTACT_NOT_ELIGIBLE answer', async (t) => {
  const { server, store } = await app(t);
  const dana = await tokenFor(server, 'dana');
  const add = (userId) => as(request(server).post('/api/contacts'), dana).send({ userId });
  const added = await add('11').expect(201);
  assert.deepEqual(added.body, { userId: '11', username: 'omar', displayName: null, role: DRIVER, status: 'offline' });
  assert.deepEqual(store.contacts, [{ organizationId: '1', ownerUserId: '10', contactUserId: '11' }]);
  // Finance (role), Karim (other company), Ivy (membership off), Jon (account off), an id nobody has.
  const answers = [];
  // Only the timestamp may differ between the answers.
  for (const id of ['12', '20', '14', '15', '999']) {
    const { statusCode, message, code } = (await add(id).expect(403)).body;
    answers.push({ statusCode, message, code });
  }
  assert.equal(answers[0].code, 'CONTACT_NOT_ELIGIBLE');
  for (const answer of answers) assert.deepEqual(answer, answers[0]);
  assert.equal(store.contacts.length, 1);
  // The body is checked: the id must be a number string.
  await add('abc').expect(400);
  await as(request(server).post('/api/contacts'), dana).send({}).expect(400);
});

test('you cannot add yourself, and adding twice answers CONTACT_EXISTS with one row', async (t) => {
  const { server, store } = await app(t);
  const dana = await tokenFor(server, 'dana');
  const add = (userId) => as(request(server).post('/api/contacts'), dana).send({ userId });
  assert.equal((await add('10').expect(400)).body.code, 'CONTACT_SELF');
  await add('11').expect(201);
  assert.equal((await add('11').expect(409)).body.code, 'CONTACT_EXISTS');
  assert.equal(store.contacts.length, 1);
  assert.equal(store.auditEntries.filter((entry) => entry.module === 'contacts').length, 1);
});

test('the server checks eligibility again at add time', async (t) => {
  const { server, store } = await app(t);
  const dana = await tokenFor(server, 'dana');
  assert.deepEqual(names(await as(request(server).get('/api/contacts/candidates'), dana).expect(200)), ['omar', 'noor']);
  // Her role changes to finance after the list was loaded; her page still offers Omar.
  store.memberships.find((row) => row.organizationId === '1' && row.userId === '10').roleId = '3';
  assert.equal((await as(request(server).post('/api/contacts'), dana).send({ userId: '11' }).expect(403)).body.code, 'CONTACT_NOT_ELIGIBLE');
  // And a person suspended after the list was loaded.
  store.memberships.find((row) => row.organizationId === '1' && row.userId === '10').roleId = '2';
  store.memberships.find((row) => row.organizationId === '1' && row.userId === '13').isActive = false;
  assert.equal((await as(request(server).post('/api/contacts'), dana).send({ userId: '13' }).expect(403)).body.code, 'CONTACT_NOT_ELIGIBLE');
  assert.equal(store.contacts.length, 0);
});

test('removing deletes only your row; removing a stranger answers CONTACT_NOT_FOUND', async (t) => {
  const { server, store } = await app(t);
  save(store, '1', '10', '11');
  save(store, '1', '13', '11');
  save(store, '2', '10', '11');
  const dana = await tokenFor(server, 'dana');
  await as(request(server).delete('/api/contacts/11'), dana).expect(204);
  // Noor's contact and the Harbor contact stay.
  assert.deepEqual(store.contacts, [
    { organizationId: '1', ownerUserId: '13', contactUserId: '11' },
    { organizationId: '2', ownerUserId: '10', contactUserId: '11' },
  ]);
  // Not a contact, not in this company, not even an id.
  for (const id of ['11', '13', '20', '999', 'abc']) {
    assert.equal((await as(request(server).delete(`/api/contacts/${id}`), dana).expect(404)).body.code, 'CONTACT_NOT_FOUND');
  }
  assert.equal(store.contacts.length, 2);
});

test('every route needs contacts.manage_own and a verified company', async (t) => {
  const { server } = await app(t);
  const routes = [['get', '/api/contacts'], ['get', '/api/contacts/candidates'], ['post', '/api/contacts'], ['delete', '/api/contacts/11']];
  for (const [method, path] of routes) await request(server)[method](path).expect(401);
  // A role without the permission, and a person who is not in the company named.
  const zara = await tokenFor(server, 'zara.platform');
  const karim = await tokenFor(server, 'karim');
  for (const [method, path] of routes) {
    await as(request(server)[method](path).send({ userId: '11' }), zara).expect(403);
    await as(request(server)[method](path).send({ userId: '11' }), karim, '1').expect(403);
  }
  const dana = await tokenFor(server, 'dana');
  await request(server).get('/api/contacts').set('Authorization', `Bearer ${dana}`).expect(400);
});

test('add and remove each write one audit row in the same transaction, and a failed audit saves nothing', async (t) => {
  const { server, store } = await app(t);
  const dana = await tokenFor(server, 'dana');
  const trail = () => store.auditEntries.filter((entry) => entry.module === 'contacts').map(({ module, action, resourceType, recordId, resourceLabel, organizationId, actorId, before, after }) => (
    { module, action, resourceType, recordId, resourceLabel, organizationId, actorId, before, after }));
  await as(request(server).post('/api/contacts'), dana).send({ userId: '11' }).expect(201);
  await as(request(server).delete('/api/contacts/11'), dana).expect(204);
  const base = { module: 'contacts', resourceType: 'contact', recordId: '11', resourceLabel: 'omar', organizationId: '1', actorId: '10' };
  assert.deepEqual(trail(), [
    { ...base, action: 'create', before: null, after: { contactUserId: '11' } },
    { ...base, action: 'delete', before: { contactUserId: '11' }, after: null },
  ]);
  // When the audit row cannot be written, the change is not kept.
  store.repositories.auditService.record = async () => { throw new Error('audit down'); };
  await as(request(server).post('/api/contacts'), dana).send({ userId: '11' }).expect(500);
  assert.equal(store.contacts.length, 0);
  save(store, '1', '10', '11');
  await as(request(server).delete('/api/contacts/11'), dana).expect(500);
  assert.equal(store.contacts.length, 1);
});

test('a connected contact shows Online, a disconnected one Offline, and a suspended one Suspended even with a live socket', async (t) => {
  const { server, store } = await app(t);
  for (const id of ['11', '13', '14']) save(store, '1', '10', id);
  // Omar and Ivy are connected. Ivy's membership is suspended, so her live socket does not count.
  store.online.add('1:11');
  store.online.add('1:14');
  const dana = await tokenFor(server, 'dana');
  const list = (await as(request(server).get('/api/contacts'), dana).expect(200)).body;
  assert.deepEqual(list.map(({ username, status }) => [username, status]), [['ivy', 'suspended'], ['omar', 'online'], ['noor', 'offline']]);
  // Candidates and the answer to an add carry the same live status.
  store.contacts.length = 0;
  store.online.add('1:13');
  const candidates = (await as(request(server).get('/api/contacts/candidates'), dana).expect(200)).body;
  assert.deepEqual(candidates.map(({ username, status }) => [username, status]), [['omar', 'online'], ['noor', 'online']]);
  const added = await as(request(server).post('/api/contacts'), dana).send({ userId: '13' }).expect(201);
  assert.equal(added.body.status, 'online');
});

test('the status of a person online in another company does not show here', async (t) => {
  const { server, store } = await app(t);
  save(store, '1', '10', '11');
  save(store, '2', '10', '11');
  // Omar is connected to Harbor only.
  store.online.add('2:11');
  const dana = await tokenFor(server, 'dana');
  assert.equal((await as(request(server).get('/api/contacts'), dana, '1').expect(200)).body[0].status, 'offline');
  assert.equal((await as(request(server).get('/api/contacts'), dana, '2').expect(200)).body[0].status, 'online');
});
