import type { MigrationInterface, QueryRunner } from 'typeorm';

// Permission codes from section 4 of .docs/ERP-Logistics-System-Outline-v1.md.
const PERMISSIONS: [code: string, module: string, description: string][] = [
  ['clients.view', 'clients', 'View client profiles and contact directories'],
  ['clients.create', 'clients', 'Add new merchant accounts'],
  ['clients.edit', 'clients', 'Update merchant terms, rates, and contact details'],
  ['clients.delete', 'clients', 'Archive or deactivate client records'],
  ['clients.view_financials', 'clients', 'View client live balance, rates, and ledgers'],
  ['parcels.view', 'parcels', 'View parcel tracking and run lists'],
  ['parcels.create', 'parcels', 'Create individual or bulk upload parcel waybills'],
  ['parcels.dispatch', 'parcels', 'Assign parcels to drivers and generate run sheets'],
  ['parcels.update_status', 'parcels', 'Update operational parcel status (Sort, In Hub, RTS)'],
  ['parcels.mark_delivered', 'parcels', 'Submit proof-of-delivery (photo, signature, notes)'],
  ['parcels.override_fee', 'parcels', 'Modify delivery charges or COD amounts on parcels'],
  ['staff.view', 'staff', 'View internal office staff directory'],
  ['staff.manage', 'staff', 'Onboard, edit, and offboard office staff'],
  ['staff.view_payroll', 'staff', 'View office staff salaries and banking data'],
  ['drivers.view', 'drivers', 'View driver list, contact numbers, and duty statuses'],
  ['drivers.manage', 'drivers', 'Onboard drivers, configure commission rates, update licenses'],
  ['drivers.view_compliance', 'drivers', 'View driver licenses, background checks, and expirations'],
  ['drivers.view_earnings', 'drivers', 'View driver commissions and payout records'],
  ['assets.view', 'assets', 'View fleet inventory and assigned equipment'],
  ['assets.create', 'assets', 'Add new vehicles, bikes, and scanners'],
  ['assets.assign', 'assets', 'Check-in / check-out equipment to drivers'],
  ['assets.log_maintenance', 'assets', 'Record servicing, repairs, and inspection dates'],
  ['billing.view', 'billing', 'View client balances and invoice lists'],
  ['billing.reconcile_cod', 'billing', 'Approve driver daily COD handovers'],
  ['billing.create_invoice', 'billing', 'Generate itemized billing statements'],
  ['billing.adjust_balance', 'billing', 'Post manual ledger adjustments or payout records'],
  ['billing.export', 'billing', 'Export financial ledgers and settlement reports'],
  ['admin.manage_users', 'admin', 'Create user accounts, assign allowed tenant memberships/roles, and link same-tenant employee profiles'],
  ['admin.manage_roles', 'admin', 'Create and edit role permission mappings'],
  ['admin.audit_logs', 'admin', 'View operational and financial audit logs'],
];

// Default roles from section 5. platform_admin has no codes yet ("exact codes to be agreed"); a user_roles row with it means platform access.
const ROLES: { code: string; name: string; description: string; scope: 'all' | 'assigned_only'; permissions: string[] }[] = [
  { code: 'platform_admin', name: 'Platform Admin', description: 'Platform tenant management; no automatic access to tenant records', scope: 'all', permissions: [] },
  { code: 'org_admin', name: 'Tenant Admin', description: 'Manages its own organization; no platform authority', scope: 'all',
    permissions: ['admin.manage_users', 'admin.manage_roles', 'admin.audit_logs'] },
  { code: 'dispatcher', name: 'Dispatcher', description: 'Route management and fleet assignment', scope: 'all',
    permissions: ['clients.view', 'clients.create', 'clients.edit', 'parcels.view', 'parcels.create', 'parcels.dispatch', 'parcels.update_status', 'parcels.mark_delivered', 'drivers.view', 'assets.view', 'assets.assign'] },
  { code: 'hub_sorter', name: 'Hub Sorter', description: 'Inbound intake, sorting, and hub transfer verification', scope: 'all',
    permissions: ['parcels.view', 'parcels.update_status'] },
  { code: 'finance', name: 'Finance', description: 'Financial ledger control, COD settlement, invoicing, and payroll audit', scope: 'all',
    permissions: ['clients.view', 'clients.create', 'clients.view_financials', 'parcels.view', 'parcels.override_fee', 'staff.view_payroll', 'drivers.view', 'drivers.view_earnings', 'billing.view', 'billing.reconcile_cod', 'billing.create_invoice', 'billing.adjust_balance', 'billing.export', 'admin.audit_logs'] },
  { code: 'hr_manager', name: 'HR Manager', description: 'Personnel management, driver onboarding, compliance, and payroll records', scope: 'all',
    permissions: ['staff.view', 'staff.manage', 'staff.view_payroll', 'drivers.view', 'drivers.manage', 'drivers.view_compliance', 'drivers.view_earnings'] },
  { code: 'fleet_lead', name: 'Fleet Lead', description: 'Vehicle inventory, maintenance, and driver licensing compliance', scope: 'all',
    permissions: ['drivers.view', 'drivers.view_compliance', 'assets.view', 'assets.create', 'assets.assign', 'assets.log_maintenance'] },
  { code: 'driver', name: 'Courier / Driver', description: 'Assigned run sheet and personal commission summary only', scope: 'assigned_only',
    permissions: ['parcels.view', 'parcels.update_status', 'parcels.mark_delivered', 'drivers.view_earnings'] },
];

export class AuthReferenceData1792195260000 implements MigrationInterface {
  // Data only, so it can run in one transaction.
  transaction = true;

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [code, module, description] of PERMISSIONS) {
      await queryRunner.query('INSERT INTO permissions (code, module, description) VALUES (?, ?, ?)', [code, module, description]);
    }
    for (const role of ROLES) {
      await queryRunner.query('INSERT INTO roles (code, name, description) VALUES (?, ?, ?)', [role.code, role.name, role.description]);
      for (const permission of role.permissions) {
        await queryRunner.query(
          `INSERT INTO role_permissions (role_id, permission_id, scope)
           SELECT r.id, p.id, ? FROM roles r JOIN permissions p ON p.code = ? WHERE r.code = ?`,
          [role.scope, permission, role.code],
        );
      }
    }
  }

  // Fails while any membership still uses one of these roles (organization_members.role_id is ON DELETE RESTRICT).
  async down(queryRunner: QueryRunner): Promise<void> {
    const roleCodes = ROLES.map((role) => role.code);
    const permissionCodes = PERMISSIONS.map(([code]) => code);
    await queryRunner.query(`DELETE FROM roles WHERE code IN (${roleCodes.map(() => '?').join(', ')})`, roleCodes);
    await queryRunner.query(`DELETE FROM permissions WHERE code IN (${permissionCodes.map(() => '?').join(', ')})`, permissionCodes);
  }
}
