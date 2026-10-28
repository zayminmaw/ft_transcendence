import type { MigrationInterface, QueryRunner } from 'typeorm';

// Files kept by the storage module (proof-of-delivery photos first). The bytes live on disk under STORAGE_DIR; this row
// holds the company that owns the file and what the client sent.
export class StorageFiles1792627200000 implements MigrationInterface {
  // MariaDB DDL commits implicitly.
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE storage_files (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        organization_id BIGINT UNSIGNED NOT NULL,
        uploaded_by_user_id BIGINT UNSIGNED NULL,
        stored_name CHAR(36) NOT NULL UNIQUE,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size_bytes INT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_storage_files_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
        CONSTRAINT fk_storage_files_user FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
        INDEX idx_storage_files_organization_id (organization_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE storage_files');
  }
}
