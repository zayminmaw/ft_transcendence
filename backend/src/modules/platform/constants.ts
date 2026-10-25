import type { TenantListQuery } from './types/tenant';

export const TENANT_ADMIN_ROLE = 'org_admin';

// The company roles an administrator can be moved to when revoked. org_admin and platform_admin are never offered.
export const MEMBER_ROLES = ['dispatcher', 'hub_sorter', 'finance', 'hr_manager', 'fleet_lead', 'driver'] as const;

// What happens to a revoked administrator. suspend_tenant is the only choice, and only allowed, for the last one.
export const REVOKE_OUTCOMES = ['change_role', 'remove', 'suspend_tenant'] as const;

// The "existing member" choice lists at most this many members; a search narrows it.
export const CANDIDATE_LIMIT = 50;

// Error bodies for the tenant routes. The codes are what the frontend matches on.
export const TENANT_CONFLICTS = {
  slug: { message: 'Another company already uses that slug.', code: 'TENANT_SLUG_TAKEN' },
  username: { message: 'That username already belongs to an account.', code: 'USERNAME_TAKEN' },
  email: { message: 'That email already belongs to an account.', code: 'EMAIL_TAKEN' },
} as const;

export const TENANT_NOT_FOUND = { message: 'Tenant not found.', code: 'TENANT_NOT_FOUND' };
export const TENANT_ALREADY_ACTIVE = { message: 'The tenant is already active.', code: 'TENANT_ALREADY_ACTIVE' };
export const TENANT_ALREADY_SUSPENDED = { message: 'The tenant is already suspended.', code: 'TENANT_ALREADY_SUSPENDED' };
export const TENANT_HAS_NO_ADMINISTRATOR = {
  message: 'Assign an administrator before reactivating the tenant.',
  code: 'TENANT_HAS_NO_ADMINISTRATOR',
};

export const ADMINISTRATOR_PROBLEMS = {
  member_not_found: { message: 'That person is not an active member of this company.', code: 'MEMBER_NOT_FOUND' },
  already_administrator: { message: 'That person is already an administrator of this company.', code: 'ALREADY_ADMINISTRATOR' },
  administrator_not_found: { message: 'That person is not an administrator of this company.', code: 'ADMINISTRATOR_NOT_FOUND' },
  last_administrator: {
    message: 'This is the company\'s last administrator. Revoking them suspends the tenant.',
    code: 'LAST_ADMINISTRATOR',
  },
  not_last_administrator: {
    message: 'Other administrators remain, so the tenant is not suspended. Choose what happens to this administrator.',
    code: 'NOT_LAST_ADMINISTRATOR',
  },
} as const;

// The list's sort keys and the SQL each one orders by; only these columns can reach ORDER BY.
export const SORT_COLUMNS: Record<TenantListQuery['sort'], string> = { name: 'organization.name', members: '`activeMembers`', createdAt: 'organization.createdAt' };
