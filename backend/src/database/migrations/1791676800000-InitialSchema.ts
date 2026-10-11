import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1791676800000 implements MigrationInterface {
  // MariaDB DDL commits implicitly. This baseline is for an empty database only.
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    const sql = await readFile(join(__dirname, 'initial-schema.sql'), 'utf8');
    const statements = sql.replace(/^\s*--.*$/gm, '').split(';').map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await queryRunner.query(statement);
  }

  async down(): Promise<void> {
    throw new Error('The initial ERP schema cannot be reverted automatically. Restore a reviewed database backup instead.');
  }
}
