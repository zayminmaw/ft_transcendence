import type { MigrationInterface, QueryRunner } from 'typeorm';

// The clients API made two gaps in the default roles visible: no role could archive a merchant (clients.delete), and
// no role could change a rate tier after creating the client (clients.edit with clients.view_financials). Dispatchers
// run the merchant directory, so they archive; finance owns the rates, so it edits.
const GRANTS: [role: string, permission: string][] = [
  ['dispatcher', 'clients.delete'],
  ['finance', 'clients.edit'],
];

export class ClientRolePermissions1793318400000 implements MigrationInterface {
  // Data only, so it can run in one transaction.
  transaction = true;

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [role, permission] of GRANTS) {
      // A grant an administrator already added by hand is kept as it is.
      await queryRunner.query(
        `INSERT INTO role_permissions (role_id, permission_id, scope)
         SELECT r.id, p.id, 'all' FROM roles r JOIN permissions p ON p.code = ?
         WHERE r.code = ? AND NOT EXISTS (
           SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
         )`,
        [permission, role],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const [role, permission] of GRANTS) {
      await queryRunner.query(
        `DELETE rp FROM role_permissions rp
         JOIN roles r ON r.id = rp.role_id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE r.code = ? AND p.code = ?`,
        [role, permission],
      );
    }
  }
}
