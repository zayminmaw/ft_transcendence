import type { MigrationInterface, QueryRunner } from 'typeorm';

// Grants tenant administrators (org_admin) every tenant-scoped operational permission with scope 'all' so a company's
// administrator can view and manage every module in their own organization. Platform administration remains strictly
// separate via user_roles ('platform_admin') and cross-tenant isolation is unchanged.
const ADDED_PERMISSIONS: readonly string[] = [
  'clients.view',
  'clients.create',
  'clients.edit',
  'clients.delete',
  'clients.view_financials',
  'parcels.view',
  'parcels.create',
  'parcels.dispatch',
  'parcels.update_status',
  'parcels.mark_delivered',
  'parcels.override_fee',
  'staff.view',
  'staff.manage',
  'staff.view_payroll',
  'drivers.view',
  'drivers.manage',
  'drivers.view_compliance',
  'drivers.view_earnings',
  'assets.view',
  'assets.create',
  'assets.assign',
  'assets.log_maintenance',
  'billing.view',
  'billing.reconcile_cod',
  'billing.create_invoice',
  'billing.adjust_balance',
  'billing.export',
];

export class OrgAdminAllPermissions1793923200000 implements MigrationInterface {
  // Data only, so it can run in one transaction.
  transaction = true;

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const permission of ADDED_PERMISSIONS) {
      // Idempotent: any grant already added manually is preserved.
      await queryRunner.query(
        `INSERT INTO role_permissions (role_id, permission_id, scope)
         SELECT r.id, p.id, 'all' FROM roles r JOIN permissions p ON p.code = ?
         WHERE r.code = 'org_admin' AND NOT EXISTS (
           SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
         )`,
        [permission],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const permission of ADDED_PERMISSIONS) {
      await queryRunner.query(
        `DELETE rp FROM role_permissions rp
         JOIN roles r ON r.id = rp.role_id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE r.code = 'org_admin' AND p.code = ?`,
        [permission],
      );
    }
  }
}

