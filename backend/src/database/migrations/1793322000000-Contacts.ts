import type { MigrationInterface, QueryRunner } from 'typeorm';

// Contacts (auth part 2c): a person's saved colleagues in one company, one row per owner and contact. Both are
// memberships, and both composite foreign keys carry organization_id, so the database itself keeps the pair inside the
// company the row names. A row goes with either membership.
export class Contacts1793322000000 implements MigrationInterface {
  // MariaDB DDL commits implicitly.
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    // The target of the composite foreign keys below.
    await queryRunner.query('ALTER TABLE organization_members ADD UNIQUE KEY uq_om_id_org (id, organization_id)');
    await queryRunner.query(`
      CREATE TABLE contacts (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        organization_id BIGINT UNSIGNED NOT NULL,
        owner_member_id BIGINT UNSIGNED NOT NULL,
        contact_member_id BIGINT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_contacts_pair (owner_member_id, contact_member_id),
        CONSTRAINT chk_contacts_not_self CHECK (owner_member_id <> contact_member_id),
        CONSTRAINT fk_contacts_owner FOREIGN KEY (owner_member_id, organization_id)
          REFERENCES organization_members (id, organization_id) ON DELETE CASCADE,
        CONSTRAINT fk_contacts_contact FOREIGN KEY (contact_member_id, organization_id)
          REFERENCES organization_members (id, organization_id) ON DELETE CASCADE,
        INDEX idx_contacts_contact (contact_member_id, organization_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE contacts');
    await queryRunner.query('ALTER TABLE organization_members DROP INDEX uq_om_id_org');
  }
}
