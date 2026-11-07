import type { MigrationInterface, QueryRunner } from 'typeorm';

const CODE = 'contacts.manage_own';
// Every role that works inside a company. platform_admin has no contacts. The permission covers one's own list only.
const ROLES = ['org_admin', 'dispatcher', 'hub_sorter', 'finance', 'hr_manager', 'fleet_lead', 'driver'];

export class ContactsPermission1793322060000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('INSERT INTO permissions (code, module, description) VALUES (?, ?, ?)', [
      CODE,
      'contacts',
      'Add and remove your own contacts and see their status',
    ]);
    for (const role of ROLES) {
      await queryRunner.query(
        `INSERT INTO role_permissions (role_id, permission_id, scope)
         SELECT r.id, p.id, 'all' FROM roles r JOIN permissions p ON p.code = ? WHERE r.code = ?`,
        [CODE, role],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // role_permissions rows go with the permission (ON DELETE CASCADE).
    await queryRunner.query('DELETE FROM permissions WHERE code = ?', [CODE]);
  }
}
