import type { MigrationInterface, QueryRunner } from 'typeorm';

// Your profile picture (auth part 2b): an account file in storage_files. NULL: your initials show instead. Deleting the
// file row clears it, so a missing picture can never break the account.
export class UserAvatar1793235600000 implements MigrationInterface {
  // MariaDB DDL commits implicitly.
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN avatar_file_id BIGINT UNSIGNED NULL AFTER display_name,
        ADD CONSTRAINT fk_users_avatar_file FOREIGN KEY (avatar_file_id) REFERENCES storage_files (id) ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users DROP FOREIGN KEY fk_users_avatar_file');
    await queryRunner.query('ALTER TABLE users DROP COLUMN avatar_file_id');
  }
}
