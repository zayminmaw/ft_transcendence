import type { MigrationInterface, QueryRunner } from 'typeorm';

// The name people choose for themselves on their profile (auth part 2b). NULL: their username shows instead.
export class UserDisplayName1793059200000 implements MigrationInterface {
  // MariaDB DDL commits implicitly.
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users ADD COLUMN display_name VARCHAR(64) NULL AFTER email');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users DROP COLUMN display_name');
  }
}
