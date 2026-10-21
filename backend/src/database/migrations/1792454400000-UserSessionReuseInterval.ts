import type { MigrationInterface, QueryRunner } from 'typeorm';

// Two quick reloads: the second cancels the first page's refresh, so the server has swapped the secret but the browser
// never got the new one. The session keeps the replaced secret's hash and when it was replaced, so that one secret
// still works for 10 seconds (a reuse interval, like Okta's and Supabase's) instead of looking copied.
export class UserSessionReuseInterval1792454400000 implements MigrationInterface {
  // MariaDB DDL commits implicitly.
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE user_sessions
      ADD COLUMN previous_token_hash CHAR(64) NULL AFTER token_hash,
      ADD COLUMN rotated_at TIMESTAMP NULL DEFAULT NULL AFTER previous_token_hash`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE user_sessions DROP COLUMN rotated_at, DROP COLUMN previous_token_hash');
  }
}
