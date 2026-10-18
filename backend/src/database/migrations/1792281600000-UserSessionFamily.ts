import type { MigrationInterface, QueryRunner } from 'typeorm';

// A refresh token becomes "<familyId>.<secret>". The family id finds the session, so any secret that isn't the
// current one, however old, shows the token was copied (previous_token_hash only caught the last one). Existing
// sessions can't be converted: they end, and their users log in again.
export class UserSessionFamily1792281600000 implements MigrationInterface {
  // MariaDB DDL commits implicitly.
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM user_sessions');
    await queryRunner.query(`ALTER TABLE user_sessions
      ADD COLUMN family_id CHAR(22) NOT NULL AFTER user_id,
      ADD UNIQUE KEY uq_user_sessions_family_id (family_id),
      DROP INDEX idx_user_sessions_previous_token_hash,
      DROP COLUMN previous_token_hash`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM user_sessions');
    await queryRunner.query(`ALTER TABLE user_sessions
      DROP INDEX uq_user_sessions_family_id,
      DROP COLUMN family_id,
      ADD COLUMN previous_token_hash CHAR(64) NULL AFTER token_hash,
      ADD INDEX idx_user_sessions_previous_token_hash (previous_token_hash)`);
  }
}
