const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { Controller, Delete, Get, HttpCode, Inject, Module, Param, Post, Req, UploadedFile, UseInterceptors } = require('@nestjs/common');
const { FileInterceptor } = require('@nestjs/platform-express');
const request = require('supertest');
const { Authenticated } = require('../dist/common/decorators/authenticated.decorator');
const { RequirePermission } = require('../dist/common/decorators/require-permission.decorator');
const { StorageModule, StorageService, documentUploadOptions, imageUploadOptions } = require('../dist/modules/storage');
const { hashPassword } = require('../dist/modules/users/password');
const { PASSWORD, as, createAuthApp, createFakeStore, tokenFor } = require('./helpers/auth-app.cjs');

process.env.NODE_ENV = 'test';
// Not a real image: the upload only checks the type the client sends.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

let storage;
before(async () => {
  storage = await mkdtemp(join(tmpdir(), 'transcend-storage-'));
  process.env.STORAGE_DIR = storage;
});
after(() => rm(storage, { recursive: true, force: true }));

// Storage has no routes of its own. This stands in for a module that owns uploads (e.g. parcels): its own endpoints
// and permissions, with StorageService doing the rest.
class PhotosFixtureController {
  constructor(storageService) { this.storage = storageService; }
  upload(file, request) { return this.storage.save(request.tenant.organizationId, request.user.id, file); }
  uploadDocument(file, request) { return this.storage.save(request.tenant.organizationId, request.user.id, file); }
  find(id, request) { return this.storage.find(request.tenant.organizationId, id); }
  content(id, request) { return this.storage.download(request.tenant.organizationId, id); }
  async link(id, request) { return { url: await this.storage.signedUrl(request.tenant.organizationId, id) }; }
  async remove(id, request) { await this.storage.delete(request.tenant.organizationId, id); }
}
Inject(StorageService)(PhotosFixtureController, undefined, 0);
Controller('fixture/photos')(PhotosFixtureController);
const route = (name, method, permission, ...decorators) => {
  const descriptor = Object.getOwnPropertyDescriptor(PhotosFixtureController.prototype, name);
  for (const decorate of [method, RequirePermission(permission), ...decorators]) decorate(PhotosFixtureController.prototype, name, descriptor);
};
route('upload', Post(), 'fixture.upload', UseInterceptors(FileInterceptor('file', imageUploadOptions)));
route('uploadDocument', Post('documents'), 'fixture.upload', UseInterceptors(FileInterceptor('file', documentUploadOptions)));
for (const name of ['upload', 'uploadDocument']) {
  UploadedFile()(PhotosFixtureController.prototype, name, 0);
  Req()(PhotosFixtureController.prototype, name, 1);
}
route('find', Get(':id'), 'fixture.view');
route('content', Get(':id/content'), 'fixture.view');
route('link', Get(':id/link'), 'fixture.view');
route('remove', Delete(':id'), 'fixture.upload', HttpCode(204));
for (const name of ['find', 'content', 'link', 'remove']) {
  Param('id')(PhotosFixtureController.prototype, name, 0);
  Req()(PhotosFixtureController.prototype, name, 1);
}
// Stands in for a module that keeps files of an account rather than a company (e.g. auth's profile pictures): no
// company header, so the person's own account is all it checks.
class AccountFilesFixtureController {
  constructor(storageService) { this.storage = storageService; }
  upload(file, request) { return this.storage.saveAccountFile(request.user.id, file); }
  async link(id) { return { url: await this.storage.accountFileUrl(id) }; }
  async remove(id) { await this.storage.deleteAccountFile(id); }
}
Inject(StorageService)(AccountFilesFixtureController, undefined, 0);
Controller('fixture/account-files')(AccountFilesFixtureController);
const accountRoute = (name, ...decorators) => {
  const descriptor = Object.getOwnPropertyDescriptor(AccountFilesFixtureController.prototype, name);
  for (const decorate of [Authenticated(), ...decorators]) decorate(AccountFilesFixtureController.prototype, name, descriptor);
};
accountRoute('upload', Post(), UseInterceptors(FileInterceptor('file', imageUploadOptions)));
UploadedFile()(AccountFilesFixtureController.prototype, 'upload', 0);
Req()(AccountFilesFixtureController.prototype, 'upload', 1);
accountRoute('link', Get(':id/link'));
accountRoute('remove', Delete(':id'), HttpCode(204));
for (const name of ['link', 'remove']) Param('id')(AccountFilesFixtureController.prototype, name, 0);

class PhotosFixtureModule {}
Module({ imports: [StorageModule], controllers: [PhotosFixtureController, AccountFilesFixtureController] })(PhotosFixtureModule);

// Meridian (company 1): dana can upload, otto can only read. Karim belongs to Harbor (company 2).
async function storageApp(t) {
  const passwordHash = await hashPassword(PASSWORD);
  const store = createFakeStore();
  store.rolePermissions.set('5', new Set(['fixture.view', 'fixture.upload']));
  store.rolePermissions.set('6', new Set(['fixture.view']));
  for (const [id, username, organizationId, roleId] of [['20', 'dana', '1', '5'], ['21', 'otto', '1', '6'], ['22', 'karim', '2', '5']]) {
    store.users.push({ id, username, email: `${username}@demo.example.test`, passwordHash, isActive: true, lastLoginAt: null });
    store.memberships.push({ organizationId, userId: id, roleId, isActive: true });
  }
  return { store, ...(await createAuthApp(t, store, { imports: [PhotosFixtureModule] })) };
}

const upload = (server, token, content = PNG, options = { filename: 'doorstep.png', contentType: 'image/png' }) =>
  as(request(server).post('/api/fixture/photos'), token).attach('file', content, options);
const binary = (response, done) => {
  const chunks = [];
  response.on('data', (chunk) => chunks.push(chunk));
  response.on('end', () => done(null, Buffer.concat(chunks)));
};

test('a saved image is stored under its company and can be read back', async (t) => {
  const { server, store } = await storageApp(t);
  const dana = await tokenFor(server, 'dana');
  const created = (await upload(server, dana).expect(201)).body;
  assert.equal(created.originalName, 'doorstep.png');
  assert.equal(created.mimeType, 'image/png');
  assert.equal(created.sizeBytes, PNG.length);
  assert.deepEqual(Object.keys(created).sort(), ['createdAt', 'id', 'mimeType', 'originalName', 'sizeBytes']);

  // On disk under <STORAGE_DIR>/<company>/<uuid>, never the client's filename.
  const [row] = store.storageFiles;
  assert.equal(row.organizationId, '1');
  assert.equal(row.uploadedByUserId, '20');
  assert.match(row.storedName, /^[0-9a-f-]{36}$/);
  assert.deepEqual(await readFile(join(storage, '1', row.storedName)), PNG);

  const otto = await tokenFor(server, 'otto');
  assert.deepEqual((await as(request(server).get(`/api/fixture/photos/${created.id}`), otto).expect(200)).body, created);
  const content = await as(request(server).get(`/api/fixture/photos/${created.id}/content`), otto).buffer(true).parse(binary).expect(200);
  assert.equal(content.headers['content-type'], 'image/png');
  assert.equal(content.headers['cache-control'], 'no-store');
  assert.deepEqual(content.body, PNG);
});

test('imageUploadOptions: only JPEG, PNG or WebP up to 10 MB', async (t) => {
  const { server, store } = await storageApp(t);
  const dana = await tokenFor(server, 'dana');
  await upload(server, dana, Buffer.from('<script>'), { filename: 'page.html', contentType: 'text/html' }).expect(400);
  await upload(server, dana, Buffer.alloc(10 * 1024 * 1024 + 1), { filename: 'huge.png', contentType: 'image/png' }).expect(413);
  await upload(server, dana, PNG, { filename: 'photo.jpg', contentType: 'image/jpeg' }).expect(201);
  assert.equal(store.storageFiles.length, 1);
});

test('documentUploadOptions: only PDF or Word up to 10 MB', async (t) => {
  const { server, store } = await storageApp(t);
  const dana = await tokenFor(server, 'dana');
  const uploadDocument = (content, options) =>
    as(request(server).post('/api/fixture/photos/documents'), dana).attach('file', content, options);
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  await uploadDocument(PNG, { filename: 'photo.png', contentType: 'image/png' }).expect(400);
  await uploadDocument(Buffer.alloc(10 * 1024 * 1024 + 1), { filename: 'huge.pdf', contentType: 'application/pdf' }).expect(413);
  await uploadDocument(Buffer.from('%PDF-1.7'), { filename: 'invoice.pdf', contentType: 'application/pdf' }).expect(201);
  await uploadDocument(Buffer.from('PK'), { filename: 'contract.docx', contentType: DOCX }).expect(201);
  await uploadDocument(Buffer.from('doc'), { filename: 'old.doc', contentType: 'application/msword' }).expect(201);
  assert.deepEqual(store.storageFiles.map((file) => file.mimeType), ['application/pdf', DOCX, 'application/msword']);
});

test('a company never sees another company\'s files', async (t) => {
  const { server } = await storageApp(t);
  const dana = await tokenFor(server, 'dana');
  const { id } = (await upload(server, dana).expect(201)).body;
  const karim = await tokenFor(server, 'karim');
  await as(request(server).get(`/api/fixture/photos/${id}`), karim, '2').expect(404);
  await as(request(server).get(`/api/fixture/photos/${id}/content`), karim, '2').expect(404);
  await as(request(server).delete(`/api/fixture/photos/${id}`), karim, '2').expect(404);
  await as(request(server).get('/api/fixture/photos/not-a-number'), dana).expect(404);
});

test('deleting a file removes the row and the bytes', async (t) => {
  const { server, store } = await storageApp(t);
  const dana = await tokenFor(server, 'dana');
  const { id } = (await upload(server, dana).expect(201)).body;
  const { storedName } = store.storageFiles[0];
  await as(request(server).delete(`/api/fixture/photos/${id}`), dana).expect(204);
  await as(request(server).get(`/api/fixture/photos/${id}`), dana).expect(404);
  assert.equal((await readdir(join(storage, '1'))).includes(storedName), false);
});

test('a signed link opens the image without a login, until it expires', async (t) => {
  const { server } = await storageApp(t);
  const dana = await tokenFor(server, 'dana');
  const { id } = (await upload(server, dana).expect(201)).body;
  const { url } = (await as(request(server).get(`/api/fixture/photos/${id}/link`), dana).expect(200)).body;
  assert.match(url, new RegExp(`^/api/storage/files/${id}\\?exp=\\d+&sig=[\\w-]{43}$`));

  // No Authorization and no X-Organization-Id: what an <img src> sends.
  const opened = await request(server).get(url).buffer(true).parse(binary).expect(200);
  assert.deepEqual(opened.body, PNG);
  assert.equal(opened.headers['content-type'], 'image/png');
  assert.match(opened.headers['cache-control'], /^private, max-age=(\d+)$/);
  assert.ok(Number(/max-age=(\d+)/.exec(opened.headers['cache-control'])[1]) <= 15 * 60);

  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 15 * 60 * 1000 + 1000 });
  await request(server).get(url).expect(403);
});

test('a tampered, borrowed or incomplete signed link is refused', async (t) => {
  const { server } = await storageApp(t);
  const dana = await tokenFor(server, 'dana');
  const first = (await upload(server, dana).expect(201)).body.id;
  const second = (await upload(server, dana).expect(201)).body.id;
  const { url } = (await as(request(server).get(`/api/fixture/photos/${first}/link`), dana).expect(200)).body;
  const { searchParams } = new URL(url, 'http://local');
  const exp = searchParams.get('exp');
  const sig = searchParams.get('sig');
  const flipped = `${sig[0] === 'A' ? 'B' : 'A'}${sig.slice(1)}`;
  await request(server).get(`/api/storage/files/${first}?exp=${exp}&sig=${flipped}`).expect(403);
  await request(server).get(`/api/storage/files/${first}?exp=${Number(exp) + 3600}&sig=${sig}`).expect(403);
  await request(server).get(`/api/storage/files/${second}?exp=${exp}&sig=${sig}`).expect(403);
  await request(server).get(`/api/storage/files/${first}?exp=${exp}`).expect(403);
  await request(server).get(`/api/storage/files/${first}`).expect(403);

  // A link is only handed out within the file's own company.
  const karim = await tokenFor(server, 'karim');
  await as(request(server).get(`/api/fixture/photos/${first}/link`), karim, '2').expect(404);
});

test('an account file belongs to no company: stored apart, opened by signed link, and out of every company\'s reach', async (t) => {
  const { server, store } = await storageApp(t);
  const dana = await tokenFor(server, 'dana');
  const bearer = (call) => call.set('Authorization', `Bearer ${dana}`);
  const picture = (await bearer(request(server).post('/api/fixture/account-files'))
    .attach('file', PNG, { filename: 'me.png', contentType: 'image/png' }).expect(201)).body;

  // On disk under <STORAGE_DIR>/accounts/<uuid>: no company folder.
  const row = store.storageFiles.find((file) => file.id === picture.id);
  assert.equal(row.organizationId, null);
  assert.equal(row.uploadedByUserId, '20');
  assert.deepEqual(await readFile(join(storage, 'accounts', row.storedName)), PNG);

  const { url } = (await bearer(request(server).get(`/api/fixture/account-files/${picture.id}/link`)).expect(200)).body;
  assert.deepEqual((await request(server).get(url).buffer(true).parse(binary).expect(200)).body, PNG);

  // A company call never reaches an account file, and an account call never reaches a company file.
  await as(request(server).get(`/api/fixture/photos/${picture.id}`), dana).expect(404);
  await as(request(server).get(`/api/fixture/photos/${picture.id}/link`), dana).expect(404);
  await as(request(server).delete(`/api/fixture/photos/${picture.id}`), dana).expect(404);
  const photo = (await upload(server, dana).expect(201)).body;
  await bearer(request(server).get(`/api/fixture/account-files/${photo.id}/link`)).expect(404);
  await bearer(request(server).delete(`/api/fixture/account-files/${photo.id}`)).expect(404);

  await bearer(request(server).delete(`/api/fixture/account-files/${picture.id}`)).expect(204);
  assert.deepEqual(store.storageFiles.map((file) => file.id), [photo.id]);
  assert.deepEqual(await readdir(join(storage, 'accounts')), []);
});
