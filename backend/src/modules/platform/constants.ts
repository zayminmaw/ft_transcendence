import type { TenantListQuery } from './types/tenant';

// Error bodies for the tenant routes. The codes are what the frontend matches on.
export const TENANT_CONFLICTS = {
  slug: { message: 'Another company already uses that slug.', code: 'TENANT_SLUG_TAKEN' },
  username: { message: 'That username already belongs to an account.', code: 'USERNAME_TAKEN' },
  email: { message: 'That email already belongs to an account.', code: 'EMAIL_TAKEN' },
} as const;

export const TENANT_NOT_FOUND = { message: 'Tenant not found.', code: 'TENANT_NOT_FOUND' };
export const TENANT_ALREADY_ACTIVE = { message: 'The tenant is already active.', code: 'TENANT_ALREADY_ACTIVE' };
export const TENANT_ALREADY_SUSPENDED = { message: 'The tenant is already suspended.', code: 'TENANT_ALREADY_SUSPENDED' };

// The list's sort keys and the SQL each one orders by; only these columns can reach ORDER BY.
export const SORT_COLUMNS: Record<TenantListQuery['sort'], string> = { name: 'organization.name', members: '`activeMembers`', createdAt: 'organization.createdAt' };
