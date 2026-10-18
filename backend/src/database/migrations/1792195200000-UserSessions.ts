import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserSessions1792195200000 implements MigrationInterface {
  // MariaDB DDL commits implicitly.
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE user_sessions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      token_hash CHAR(64) NOT NULL,
      previous_token_hash CHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      idle_expires_at TIMESTAMP NOT NULL,
      absolute_expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP NULL DEFAULT NULL,
      revoked_reason VARCHAR(32) NULL,
      user_agent VARCHAR(255) NULL,
      ip_address VARCHAR(45) NULL,
      UNIQUE KEY uq_user_sessions_token_hash (token_hash),
      INDEX idx_user_sessions_previous_token_hash (previous_token_hash),
      INDEX idx_user_sessions_user_id (user_id),
      CONSTRAINT fk_us_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE user_sessions');
  }
}
