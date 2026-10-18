require('reflect-metadata');
const mysql = require('mysql2/promise');
const { DataSource } = require('typeorm');
const { databaseOptions } = require('../../dist/database/database.config');

// Recreates "<DB_NAME>_test" in the Docker MariaDB and runs every migration on it. The real database is never touched.
async function createTestDatabase() {
  const { DB_HOST = '127.0.0.1', DB_PORT = '3306', DB_USER, DB_PASS, DB_NAME, DB_ROOT_PASSWORD } = process.env;
  if (!DB_USER || !DB_PASS || !DB_NAME || !DB_ROOT_PASSWORD) {
    throw new Error('test:db needs DB_USER, DB_PASS, DB_NAME (backend/.env) and DB_ROOT_PASSWORD (root .env), and MariaDB running.');
  }
  const name = `${DB_NAME}_test`;
  const admin = await mysql.createConnection({ host: DB_HOST, port: Number(DB_PORT), user: 'root', password: DB_ROOT_PASSWORD });
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await admin.query(`GRANT ALL PRIVILEGES ON \`${name}\`.* TO ?@'%'`, [DB_USER]);
  } finally {
    await admin.end();
  }
  const database = new DataSource(databaseOptions({ DB_HOST, DB_PORT: Number(DB_PORT), DB_USER, DB_PASS, DB_NAME: name }));
  await database.initialize();
  await database.runMigrations();
  return database;
}

module.exports = { createTestDatabase };
