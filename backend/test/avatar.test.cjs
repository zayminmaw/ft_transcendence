const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const request = require('supertest');
const { hashPassword } = require('../dist/modules/users/password');
const { ORIGIN, createAuthApp, createFakeStore } = require('./helpers/auth-app.cjs');

// The cookie's Secure flag depends on NODE_ENV; pin it like auth.test.cjs.
process.env.NODE_ENV = 'test';
// Only the first bytes of each type: StorageService checks that a file starts the way its type does.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const JPEG = Buffer.from('ffd8ffe000104a464946', 'hex');
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x1a, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const PASSWORD = 'Correct-horse-1';

const binary = (response, done) => {
  const chunks = [];
  response.on('data', (chunk) => chunks.push(chunk));
  response.on('end', () => done(null, Buffer.concat(chunks)));
};

// noor, in no company at all: your picture needs none. Each app keeps its files in its own folder.
async function noorApp(t, { mustChangePassword = false } = {}) {
  const storage = await mkdtemp(join(tmpdir(), 'transcend-avatar-'));
  t.after(() => rm(storage, { recursive: true, force: true }));
  process.env.STORAGE_DIR = storage;
  const store = createFakeStore();
  store.users.push({
    id: '9', username: 'noor', email: 'noor@demo.example.test', passwordHash: await hashPassword(PASSWORD), isActive: true,
    mustChangePassword, displayName: null, avatarFileId: null, createdAt: new Date('2026-10-01T08:00:00.000Z'),
  });
  const { server } = await createAuthApp(t, store);
  const login = await request(server).post('/api/auth/login').set('Origin', ORIGIN).send({ login: 'noor', password: PASSWORD }).expect(200);
  const bearer = (call) => call.set('Authorization', `Bearer ${login.body.accessToken}`);
  const put = (content = PNG, options = { filename: 'me.png', contentType: 'image/png' }) =>
    bearer(request(server).put('/api/auth/me/avatar')).attach('file', content, options);
  const remove = () => bearer(request(server).delete('/api/auth/me/avatar'));
  const me = async () => (await bearer(request(server).get('/api/auth/me')).expect(200)).body;
  const accountFiles = () => readdir(join(storage, 'accounts')).catch(() => []);
  return { server, store, put, remove, me, accountFiles };
}

const pictureAudit = (store) => store.audit
  .filter((entry) => entry.action === 'profile_updated' && 'avatarFileId' in (entry.newValues ?? {}))
  .map(({ oldValues, newValues }) => [oldValues.avatarFileId, newValues.avatarFileId]);

test('you upload a picture: saved as your account\'s file, shown by a signed link in the answer and /me, audited', async (t) => {
  const { server, store, put, me } = await noorApp(t);
  const { user } = (await put().expect(200)).body;
  const [file] = store.storageFiles;
  assert.equal(file.organizationId, null);
  assert.equal(file.uploadedByUserId, '9');
  assert.equal(store.users[0].avatarFileId, file.id);
  assert.match(user.avatarUrl, new RegExp(`^/api/storage/files/${file.id}\\?exp=\\d+&sig=[\\w-]{43}$`));
  assert.equal((await me()).user.avatarUrl, user.avatarUrl);
  // What an <img src> sends: no login.
  const opened = await request(server).get(user.avatarUrl).buffer(true).parse(binary).expect(200);
  assert.deepEqual(opened.body, PNG);
  // The type is the one the client claimed, so the browser must never guess another (e.g. HTML) from the bytes.
  assert.equal(opened.headers['x-content-type-options'], 'nosniff');
  assert.deepEqual(pictureAudit(store), [[null, file.id]]);
});

test('a new picture replaces the old one, whose file is deleted; removing brings the initials back', async (t) => {
  const { store, put, remove, me, accountFiles } = await noorApp(t);
  await put().expect(200);
  const first = store.storageFiles[0].id;
  await put(WEBP, { filename: 'new.webp', contentType: 'image/webp' }).expect(200);
  assert.deepEqual(store.storageFiles.map((file) => file.mimeType), ['image/webp']);
  assert.equal((await accountFiles()).length, 1);
  const second = store.storageFiles[0].id;

  assert.equal((await remove().expect(200)).body.user.avatarUrl, null);
  assert.equal((await me()).user.avatarUrl, null);
  assert.deepEqual(store.storageFiles, []);
  assert.deepEqual(await accountFiles(), []);
  // Removing again changes nothing.
  await remove().expect(200);
  assert.deepEqual(pictureAudit(store), [[null, first], [first, second], [second, null]]);
});

test('only one PNG, JPEG or WebP of at most 2 MB, and nothing is kept from a refused upload', async (t) => {
  const { store, put } = await noorApp(t);
  await put(Buffer.from('<script>'), { filename: 'page.html', contentType: 'text/html' }).expect(400);
  await put(PNG, { filename: 'me.svg', contentType: 'image/svg+xml' }).expect(400);
  await put(Buffer.alloc(2 * 1024 * 1024 + 1), { filename: 'huge.png', contentType: 'image/png' }).expect(413);
  assert.deepEqual(store.storageFiles, []);
  assert.equal(store.users[0].avatarFileId, null);
  await put(Buffer.concat([JPEG, Buffer.alloc(2 * 1024 * 1024 - JPEG.length)]), { filename: 'big.jpg', contentType: 'image/jpeg' }).expect(200);
});

test('an upload without a file is refused, and so is one without a token or before your own password', async (t) => {
  const { server, store } = await noorApp(t);
  const login = await request(server).post('/api/auth/login').set('Origin', ORIGIN).send({ login: 'noor', password: PASSWORD });
  await request(server).put('/api/auth/me/avatar').set('Authorization', `Bearer ${login.body.accessToken}`).expect(400);
  await request(server).put('/api/auth/me/avatar').attach('file', PNG, { filename: 'me.png', contentType: 'image/png' }).expect(401);
  await request(server).delete('/api/auth/me/avatar').expect(401);
  const flagged = await noorApp(t, { mustChangePassword: true });
  assert.equal((await flagged.put().expect(403)).body.code, 'AUTH_PASSWORD_CHANGE_REQUIRED');
  assert.equal((await flagged.remove().expect(403)).body.code, 'AUTH_PASSWORD_CHANGE_REQUIRED');
  assert.deepEqual([...store.storageFiles, ...flagged.store.storageFiles], []);
});

test('a picture whose file is gone shows the initials instead of breaking /me or login', async (t) => {
  const { server, store, put, me } = await noorApp(t);
  await put().expect(200);
  store.storageFiles = [];
  assert.equal((await me()).user.avatarUrl, null);
  const login = await request(server).post('/api/auth/login').set('Origin', ORIGIN).send({ login: 'noor', password: PASSWORD }).expect(200);
  assert.equal(login.body.user.avatarUrl, null);
});

test('an upload that loses to a picture saved in the meantime removes its own file and answers with that picture', async (t) => {
  const { store, put, accountFiles } = await noorApp(t);
  await put().expect(200);
  const saved = store.storageFiles[0].id;
  // The next upload read the account before that picture was saved, as two uploads at once would.
  const users = store.repositories.users;
  const { findById } = users;
  users.findById = async (id) => {
    users.findById = findById;
    return { ...(await findById(id)), avatarFileId: null };
  };
  const { user } = (await put().expect(200)).body;
  assert.match(user.avatarUrl, new RegExp(`^/api/storage/files/${saved}\\?`));
  assert.deepEqual(store.storageFiles.map((file) => file.id), [saved]);
  assert.equal((await accountFiles()).length, 1);
  assert.equal(pictureAudit(store).length, 1);
});

test('the picture and its audit row are saved together: a failed audit keeps no picture and no file, and a retry saves both', async (t) => {
  const { store, put, me, accountFiles } = await noorApp(t);
  const record = store.repositories.audit.record;
  store.repositories.audit.record = async () => { throw new Error('audit trail unavailable'); };
  await put().expect(500);
  assert.equal((await me()).user.avatarUrl, null);
  assert.deepEqual(store.storageFiles, []);
  assert.deepEqual(await accountFiles(), []);

  store.repositories.audit.record = record;
  await put().expect(200);
  assert.equal(store.users[0].avatarFileId, store.storageFiles[0].id);
  assert.equal((await accountFiles()).length, 1);
  assert.equal(pictureAudit(store).length, 1);
});
