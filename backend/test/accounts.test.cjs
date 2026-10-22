const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AccountError, createAccount } = require('../dist/modules/users/accounts');
const { verifyPassword } = require('../dist/modules/users/password');

const VALID = { username: 'dana.saleh', email: 'dana@meridian.example.test', password: 'Correct-horse-1', mustChangePassword: true };

// Stands in for TypeORM's EntityManager inside a transaction: the existence check and the insert.
function fakeManager({ existing = false, raceOnSave = false } = {}) {
  const saved = [];
  return {
    saved,
    existsBy: async () => existing,
    create: (_entity, values) => ({ ...values }),
    async save(row) {
      if (raceOnSave) throw Object.assign(new Error('Duplicate entry'), { driverError: { errno: 1062 } });
      saved.push(row);
      return { ...row, id: '42' };
    },
  };
}

const problem = (expected) => (error) => error instanceof AccountError && error.problem === expected;

test('createAccount checks the username, the email and the password before saving anything', async () => {
  const manager = fakeManager();
  await assert.rejects(createAccount(manager, { ...VALID, username: 'da' }), problem('username'));
  await assert.rejects(createAccount(manager, { ...VALID, username: 'dana saleh' }), problem('username'));
  await assert.rejects(createAccount(manager, { ...VALID, email: 'not-an-email' }), problem('email'));
  // Login only accepts plain ASCII, so an accented email could never be used to log in.
  await assert.rejects(createAccount(manager, { ...VALID, email: 'dána@meridian.example.test' }), problem('email'));
  await assert.rejects(createAccount(manager, { ...VALID, password: 'weakpassword' }), problem('password'));
  assert.deepEqual(manager.saved, []);
});

test('createAccount refuses a taken username or email, also when another request wins the race', async () => {
  await assert.rejects(createAccount(fakeManager({ existing: true }), VALID), problem('taken'));
  await assert.rejects(createAccount(fakeManager({ raceOnSave: true }), VALID), problem('taken'));
});

test('createAccount trims, hashes with Argon2id and keeps the must-change flag', async () => {
  const manager = fakeManager();
  const id = await createAccount(manager, { ...VALID, username: '  dana.saleh ', email: ' dana@meridian.example.test ' });
  assert.equal(id, '42');
  const [row] = manager.saved;
  assert.deepEqual([row.username, row.email, row.mustChangePassword], ['dana.saleh', 'dana@meridian.example.test', true]);
  assert.match(row.passwordHash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(row.passwordHash, 'Correct-horse-1'), true);
});
