import type { EntityManager } from 'typeorm';
import { type AuditAction, recordAudit } from '../audit';
import { Organization, OrganizationMember } from '../organizations';
import { Role } from '../rbac';
import { User } from '../users';
import { TENANT_ADMIN_ROLE } from './constants';
import type { AccountConflict, NewAdministrator, PlatformActor } from './types/tenant';

// Transaction steps shared by the tenant and tenant administrator repositories. Each takes the transaction's manager.

// A LIKE pattern that finds the text anywhere, with its own wildcards escaped.
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

// Locks the company row until the transaction ends. Status and administrator changes all take this lock first, so
// two of them on one company run one after the other and always count the administrators correctly.
export function lockTenant(manager: EntityManager, id: string): Promise<Organization | null> {
  return manager.findOne(Organization, { where: { id }, lock: { mode: 'pessimistic_write' } });
}

export async function findRole(manager: EntityManager, code: string): Promise<Role> {
  const role = await manager.findOneBy(Role, { code });
  if (!role) throw new Error(`The ${code} role is missing. Run the migrations first.`);
  return role;
}

// The usual duplicate gets a clear answer; the unique keys still stop two requests racing.
export async function accountConflict(manager: EntityManager, account: NewAdministrator): Promise<AccountConflict | undefined> {
  if (await manager.existsBy(User, { username: account.username })) return 'username';
  if (await manager.existsBy(User, { email: account.email })) return 'email';
  return undefined;
}

// A new account with an org_admin membership in the company. Check accountConflict first.
export async function insertAdministrator(manager: EntityManager, organizationId: string, account: NewAdministrator): Promise<User> {
  const role = await findRole(manager, TENANT_ADMIN_ROLE);
  const administrator = await manager.save(manager.create(User, account));
  await manager.insert(OrganizationMember, { organizationId, userId: administrator.id, roleId: role.id });
  return administrator;
}

// Administrators who can still sign in and manage the company: an active org_admin membership of an active account.
export function countUsableAdministrators(manager: EntityManager, organizationId: string, exceptUserId?: string): Promise<number> {
  const query = manager.createQueryBuilder()
    .from(OrganizationMember, 'member')
    .innerJoin(User, 'user', 'user.id = member.userId')
    .innerJoin(Role, 'role', 'role.id = member.roleId')
    .where('member.organizationId = :organizationId', { organizationId })
    .andWhere('member.isActive = TRUE')
    .andWhere('user.isActive = TRUE')
    .andWhere('role.code = :adminRole', { adminRole: TENANT_ADMIN_ROLE });
  if (exceptUserId) query.andWhere('member.userId <> :exceptUserId', { exceptUserId });
  return query.getCount();
}

// Only flips is_active: memberships, parcels and ledgers stay, and every tenant request already requires an active
// company. The caller holds the lockTenant lock and has checked the status really changes.
export async function changeTenantStatus(
  manager: EntityManager, actor: PlatformActor, organization: Organization, isActive: boolean, reason: string | null,
  details: object = {},
): Promise<Organization> {
  organization.isActive = isActive;
  const saved = await manager.save(organization);
  await auditPlatformChange(
    manager, actor, organization.id, isActive ? 'tenant.reactivate' : 'tenant.suspend', { isActive: !isActive },
    { isActive, reason, ...details },
  );
  return saved;
}

// Platform actions on the shared audit trail: [resource, verb].
const PLATFORM_ACTIONS: Record<string, [string, AuditAction]> = {
  'tenant.create': ['tenant', 'create'],
  'tenant.update': ['tenant', 'update'],
  'tenant.suspend': ['tenant', 'status_change'],
  'tenant.reactivate': ['tenant', 'status_change'],
  'tenant.administrator.assign': ['tenant_administrator', 'assign'],
  'tenant.administrator.revoke': ['tenant_administrator', 'revoke'],
};

// Written in the same transaction as the change, so a change is never saved without its audit row. Contact details
// are masked and the address is never stored (see AUDIT_RESOURCES).
export async function auditPlatformChange(
  manager: EntityManager, actor: PlatformActor, organizationId: string, action: keyof typeof PLATFORM_ACTIONS,
  oldValues: object | undefined, newValues: object,
) {
  const [resourceType, verb] = PLATFORM_ACTIONS[action];
  // The company's name labels the entry, so the history says "Meridian Courier", not "#1". A rename carries it.
  const renamed = (newValues as { name?: unknown }).name;
  const name = typeof renamed === 'string'
    ? renamed
    : (await manager.findOne(Organization, { where: { id: organizationId }, select: { id: true, name: true } }))?.name;
  await recordAudit(manager, {
    module: 'platform', action: verb, resourceType, recordId: organizationId, organizationId,
    resourceLabel: name,
    actorId: actor.userId, meta: actor, before: oldValues, after: newValues,
  });
}
