import type { MigrationInterface, QueryRunner } from 'typeorm';

// Files of an account rather than a company (a profile picture first): organization_id NULL. The bytes live under
// <STORAGE_DIR>/accounts/.
export class StorageAccountFiles1793232000000 implements MigrationInterface {
  // MariaDB DDL commits implicitly.
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE storage_files MODIFY organization_id BIGINT UNSIGNED NULL');
  }

  // Account files have no company to go back to, so their rows go first (their bytes stay on disk).
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM storage_files WHERE organization_id IS NULL');
    await queryRunner.query('ALTER TABLE storage_files MODIFY organization_id BIGINT UNSIGNED NOT NULL');
  }
}
