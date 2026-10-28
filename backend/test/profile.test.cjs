const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { hashPassword } = require('../dist/modules/users/password');
const { ORIGIN, createAuthApp, createFakeStore } = require('./helpers/auth-app.cjs');

// The cookie's Secure flag depends on NODE_ENV; pin it like auth.test.cjs.
process.env.NODE_ENV = 'test';

const PASSWORD = 'Correct-horse-1';

// noor, in no company at all: changing your own profile needs none.
async function noorApp(t, { mustChangePassword = false } = {}) {
  const store = createFakeStore();
  store.users.push({
    id: '9', username: 'noor', email: 'noor@demo.example.test', passwordHash: await hashPassword(PASSWORD), isActive: true,
    mustChangePassword, displayName: null, createdAt: new Date('2026-10-01T08:00:00.000Z'),
  });
  const { server } = await createAuthApp(t, store);
  const login = await request(server).post('/api/auth/login').set('Origin', ORIGIN).send({ login: 'noor', password: PASSWORD }).expect(200);
  const patch = (body) => request(server).patch('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`).send(body);
  const me = async () => (await request(server).get('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`).expect(200)).body;
  return { server, store, patch, me };
}

const profileAudit = (store) => store.audit
  .filter((entry) => entry.action === 'profile_updated')
  .map(({ action, userId, oldValues, newValues }) => ({ action, userId, oldValues, newValues }));

test('you set your display name: trimmed, saved, in the answer and /me, and audited with the old and new name', async (t) => {
  const { store, patch, me } = await noorApp(t);
  const answer = await patch({ displayName: '  Noor Haddad  ' }).expect(200);
  assert.deepEqual(answer.body, {
    user: { id: '9', username: 'noor', email: 'noor@demo.example.test', displayName: 'Noor Haddad', createdAt: '2026-10-01T08:00:00.000Z' },
  });
  assert.equal((await me()).user.displayName, 'Noor Haddad');
  assert.equal(store.users[0].displayName, 'Noor Haddad');
  assert.deepEqual(profileAudit(store), [
    { action: 'profile_updated', userId: '9', oldValues: { displayName: null }, newValues: { displayName: 'Noor Haddad' } },
  ]);
});

test('"" and null clear the name so the username shows; saving the same name again changes nothing', async (t) => {
  const { store, patch } = await noorApp(t);
  await patch({ displayName: 'Noor Haddad' }).expect(200);
  await patch({ displayName: 'Noor Haddad' }).expect(200);
  assert.equal(profileAudit(store).length, 1);
  assert.equal((await patch({ displayName: '   ' }).expect(200)).body.user.displayName, null);
  await patch({ displayName: 'นภา ใจดี' }).expect(200);
  assert.equal((await patch({ displayName: null }).expect(200)).body.user.displayName, null);
  assert.deepEqual(profileAudit(store).map((entry) => entry.newValues.displayName), ['Noor Haddad', null, 'นภา ใจดี', null]);
});

test('a name is one line of at most 64 characters, and nothing else can be changed here', async (t) => {
  const { store, patch } = await noorApp(t);
  await patch({ displayName: 'x'.repeat(64) }).expect(200);
  for (const body of [
    { displayName: 'x'.repeat(65) },
    { displayName: 'Noor\nHaddad' },
    { displayName: 42 },
    {},
    { displayName: 'Noor', username: 'someone.else' },
    { displayName: 'Noor', email: 'other@demo.example.test' },
  ]) await patch(body).expect(400);
  assert.equal(store.users[0].username, 'noor');
  assert.equal(store.users[0].displayName, 'x'.repeat(64));
});

test('changing your profile needs a token, and your own password first when an admin gave it', async (t) => {
  const { server } = await noorApp(t);
  await request(server).patch('/api/auth/me').send({ displayName: 'Noor' }).expect(401);
  const flagged = await noorApp(t, { mustChangePassword: true });
  assert.equal((await flagged.patch({ displayName: 'Noor' }).expect(403)).body.code, 'AUTH_PASSWORD_CHANGE_REQUIRED');
  assert.equal(flagged.store.users[0].displayName, null);
});
