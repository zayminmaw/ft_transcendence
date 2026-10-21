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

export interface NewTenant {
  organization: { name: string; slug: string; contactEmail: string; contactPhone: string | null; address: string | null };
  administrator: { username: string; email: string; passwordHash: string };
}

export type TenantChanges = Partial<Pick<Organization, 'name' | 'contactEmail' | 'contactPhone' | 'address'>>;

// Who made a platform change, for its audit row.
export interface PlatformActor extends RequestMeta {
  userId: string;
}

export type CreateTenantResult =
  | { created: true; organization: Organization; administrator: User }
  | { created: false; conflict: 'slug' | 'username' | 'email' };
