import type { RequestMeta } from '../../auth';
import type { Organization } from '../../organizations';
import type { User } from '../../users';

export interface TenantListQuery {
  search?: string;
  status: 'all' | 'active' | 'suspended';
  sort: 'name' | 'members' | 'createdAt';
  direction: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  // The earliest active tenant administrator, or null when the company has none.
  administrator: string | null;
  activeMembers: number;
}

export interface TenantCounts {
  total: number;
  active: number;
  suspended: number;
}

export interface TenantAdministrator {
  id: string;
  username: string;
  email: string;
  accountActive: boolean;
  joinedAt: Date;
}

export interface TenantMembership {
  members: number;
  activeMembers: number;
}

export interface NewAdministrator {
  username: string;
  email: string;
  passwordHash: string;
}

export interface NewTenant {
  organization: { name: string; slug: string; contactEmail: string; contactPhone: string | null; address: string | null };
  administrator: NewAdministrator;
}

export type TenantChanges = Partial<Pick<Organization, 'name' | 'contactEmail' | 'contactPhone' | 'address'>>;

// Who made a platform change, for its audit row.
export interface PlatformActor extends RequestMeta {
  userId: string;
}

export type AccountConflict = 'username' | 'email';

export type CreateTenantResult =
  | { created: true; organization: Organization; administrator: User }
  | { created: false; conflict: 'slug' | AccountConflict };

export type StatusChangeResult =
  | { changed: true; organization: Organization }
  | { changed: false; problem: 'not_found' | 'same_status' | 'no_administrator' };

// A member who can be made an administrator: an active account with a membership in the company, not already an
// active org_admin. A removed member (inactive membership) can be brought back this way.
export interface TenantMember {
  id: string;
  username: string;
  email: string;
  role: { code: string; name: string };
  removed: boolean;
}

export interface MemberRole {
  code: string;
  name: string;
  description: string | null;
}

export type AssignAdministrator =
  | { mode: 'new'; account: NewAdministrator }
  | { mode: 'existing'; userId: string };

export type AssignAdministratorResult =
  | { done: true; administrator: { id: string; username: string; email: string } }
  | { done: false; problem: 'tenant_not_found' | 'member_not_found' | 'already_administrator' | AccountConflict };

export type RevokeAdministrator =
  | { outcome: 'change_role'; roleCode: string; reason: string }
  | { outcome: 'remove' | 'suspend_tenant'; reason: string };

export type RevokeAdministratorResult =
  | { done: true; tenantSuspended: boolean }
  | { done: false; problem: 'tenant_not_found' | 'administrator_not_found' | 'last_administrator' | 'not_last_administrator' | 'role_not_available' };
