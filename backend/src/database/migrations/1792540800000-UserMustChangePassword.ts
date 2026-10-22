import type { MigrationInterface, QueryRunner } from 'typeorm';

// An account created by an admin, or reset by one, must replace its password at the next login (auth part 2a).
export class UserMustChangePassword1792540800000 implements MigrationInterface {
  // MariaDB DDL commits implicitly.
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE AFTER is_active');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users DROP COLUMN must_change_password');
  }
}
