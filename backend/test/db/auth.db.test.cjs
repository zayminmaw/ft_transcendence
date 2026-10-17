const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestDatabase } = require('./test-database.cjs');

let database;
before(async () => { database = await createTestDatabase(); });
after(() => database?.destroy());

const count = async (sql, params = []) => Number((await database.query(sql, params))[0].total);

test('the migrations add the sessions table and the documented roles and permissions', async () => {
  assert.equal(await count('SELECT COUNT(*) AS total FROM permissions'), 30);
  assert.equal(await count('SELECT COUNT(*) AS total FROM roles'), 8);
  assert.equal(await count('SELECT COUNT(*) AS total FROM role_permissions'), 47);
  assert.equal(await count(`SELECT COUNT(*) AS total FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
    WHERE r.code = 'driver' AND rp.scope = 'assigned_only'`), 4);
  assert.equal(await count(`SELECT COUNT(*) AS total FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
    WHERE r.code = 'platform_admin'`), 0);
  assert.equal(await count(`SELECT COUNT(*) AS total FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'user_sessions'`), 1);
});
