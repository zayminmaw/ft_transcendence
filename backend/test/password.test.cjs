const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, passwordProblems, verifyPassword } = require('../dist/modules/auth/password');

test('the password rule needs 8-128 characters with lower, upper, number and symbol', () => {
  assert.deepEqual(passwordProblems('Transcend-demo-1'), []);
  assert.deepEqual(passwordProblems('Ab1!abcd'), []);
  assert.deepEqual(passwordProblems('Ab1!abc'), ['length']);
  assert.deepEqual(passwordProblems(`Ab1!${'a'.repeat(125)}`), ['length']);
  assert.deepEqual(passwordProblems('NOLOWER1!'), ['lowercase']);
  assert.deepEqual(passwordProblems('noupper1!'), ['uppercase']);
  assert.deepEqual(passwordProblems('NoNumber!'), ['number']);
  assert.deepEqual(passwordProblems('NoSymbol1'), ['symbol']);
  assert.deepEqual(passwordProblems('has space A1'), []);
});

test('passwords are hashed with Argon2id and verified', async () => {
  const hash = await hashPassword('Transcend-demo-1');
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(hash, 'Transcend-demo-1'), true);
  assert.equal(await verifyPassword(hash, 'transcend-demo-1'), false);
  assert.equal(await verifyPassword('not-a-hash', 'Transcend-demo-1'), false);
});
