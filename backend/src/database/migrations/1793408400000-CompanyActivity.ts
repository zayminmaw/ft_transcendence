import type { MigrationInterface, QueryRunner } from 'typeorm';

// Activity insights: one row for each member of a company and day they had the company open, with how many times they
// opened it. It holds nothing else (no content, no address, no device). A row goes with its user or its company, and
// the app deletes rows older than 90 days.
export class CompanyActivity1793408400000 implements MigrationInterface {
  // MariaDB DDL commits implicitly.
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE company_activity_days (
        organization_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        day DATE NOT NULL,
        visits INT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (organization_id, user_id, day),
        INDEX idx_company_activity_day (organization_id, day),
        INDEX idx_company_activity_user (user_id),
        CONSTRAINT fk_company_activity_organization FOREIGN KEY (organization_id)
          REFERENCES organizations (id) ON DELETE CASCADE,
        CONSTRAINT fk_company_activity_user FOREIGN KEY (user_id)
          REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE company_activity_days');
  }
}
