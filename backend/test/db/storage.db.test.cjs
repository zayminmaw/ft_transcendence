const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');
const { StorageRepository } = require('../../dist/modules/storage/storage.repository');
const { Organization } = require('../../dist/modules/organizations/entities/organization.entity');
const { User } = require('../../dist/modules/users/entities/user.entity');

let database;
let files;
let north;
let south;
let uploader;
before(async () => {
  database = await createTestDatabase();
  files = new StorageRepository(database);
  const company = (slug) => database.getRepository(Organization).save({ name: `${slug} company`, slug, contactEmail: `ops@${slug}.db.test` });
  north = String((await company('north')).id);
  south = String((await company('south')).id);
  uploader = String((await database.getRepository(User).save({ username: 'dana.files', email: 'dana.files@db.test', passwordHash: 'placeholder-hash' })).id);
});
after(() => database?.destroy());

const newFile = (organizationId, storedName) => ({
  organizationId, uploadedByUserId: uploader, storedName, originalName: 'doorstep.png', mimeType: 'image/png', sizeBytes: 1234,
});

test('a file row is stored and read back with string ids, only within its company', async () => {
  const created = await files.insert(newFile(north, '11111111-1111-4111-8111-111111111111'));
  assert.match(created.id, /^\d+$/);
  assert.equal(created.organizationId, north);
  assert.equal(created.uploadedByUserId, uploader);
  assert.equal(created.sizeBytes, 1234);
  assert.ok(created.createdAt instanceof Date);
  assert.deepEqual(await files.find(north, created.id), created);
  assert.equal(await files.find(south, created.id), undefined);
  // Signed links look up by id alone.
  assert.deepEqual(await files.findById(created.id), created);
});

test('deleting is scoped to the company, and stored names are unique', async () => {
  const created = await files.insert(newFile(north, '22222222-2222-4222-8222-222222222222'));
  await files.delete(south, created.id);
  assert.ok(await files.find(north, created.id));
  await files.delete(north, created.id);
  assert.equal(await files.find(north, created.id), undefined);
  await files.insert(newFile(south, '33333333-3333-4333-8333-333333333333'));
  await assert.rejects(files.insert(newFile(north, '33333333-3333-4333-8333-333333333333')), /Duplicate/);
});

test('removing a company removes its file rows; removing the uploader keeps the file', async () => {
  const kept = await files.insert(newFile(south, '44444444-4444-4444-8444-444444444444'));
  const other = String((await database.getRepository(User).save({ username: 'gone.files', email: 'gone.files@db.test', passwordHash: 'placeholder-hash' })).id);
  const orphan = await files.insert({ ...newFile(south, '55555555-5555-4555-8555-555555555555'), uploadedByUserId: other });
  await database.getRepository(User).delete({ id: other });
  assert.equal((await files.find(south, orphan.id)).uploadedByUserId, null);
  await database.getRepository(Organization).delete({ id: south });
  assert.equal(await files.find(south, kept.id), undefined);
});

test('an account file has no company: only account lookups reach it, and company lookups never do', async () => {
  const picture = await files.insert(newFile(null, '66666666-6666-4666-8666-666666666666'));
  assert.equal(picture.organizationId, null);
  assert.deepEqual(await files.find(null, picture.id), picture);
  assert.equal(await files.find(north, picture.id), undefined);
  const photo = await files.insert(newFile(north, '77777777-7777-4777-8777-777777777777'));
  assert.equal(await files.find(null, photo.id), undefined);

  await files.delete(null, photo.id);
  await files.delete(north, picture.id);
  assert.ok(await files.find(north, photo.id));
  assert.ok(await files.find(null, picture.id));
  await files.delete(null, picture.id);
  assert.equal(await files.find(null, picture.id), undefined);
});
