export type TenantStatusFilter = 'all' | 'active' | 'suspended';
export type TenantSortKey = 'name' | 'members' | 'createdAt';

export type TenantListParams = {
	search: string;
	status: TenantStatusFilter;
	sort: TenantSortKey;
	direction: 'asc' | 'desc';
	page: number;
	pageSize: number;
};

export type TenantListItem = {
	id: string;
	name: string;
	slug: string;
	isActive: boolean;
	createdAt: string;
	administrator: string | null;
	activeMembers: number;
};

export type TenantList = {
	items: TenantListItem[];
	total: number;
	page: number;
	pageSize: number;
	counts: { total: number; active: number; suspended: number };
};

export type Tenant = {
	id: string;
	name: string;
	slug: string;
	contactEmail: string;
	contactPhone: string | null;
	address: string | null;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
};

export type TenantAdministrator = {
	id: string;
	username: string;
	email: string;
	accountActive: boolean;
	joinedAt: string;
};

export type TenantDetails = Tenant & {
	administrators: TenantAdministrator[];
	membership: { members: number; activeMembers: number };
};

export type CreateTenantValues = {
	organization: {
		name: string;
		slug: string;
		contactEmail: string;
		contactPhone: string;
		address: string;
	};
	administrator: { username: string; email: string; password: string };
};

export type CreatedTenant = {
	tenant: Tenant;
	administrator: { id: string; username: string; email: string };
};

export type UpdateTenantValues = Pick<Tenant, 'name' | 'contactEmail'> & {
	contactPhone: string;
	address: string;
};

// A member who can be made an administrator.
export type TenantMember = {
	id: string;
	username: string;
	email: string;
	role: { code: string; name: string };
};

// A company role a revoked administrator can be moved to.
export type MemberRole = { code: string; name: string; description: string | null };

export type NewAdministratorValues = CreateTenantValues['administrator'];

export type AssignAdministratorValues =
	{ mode: 'new'; account: NewAdministratorValues } | { mode: 'existing'; userId: string };

export type AssignedAdministrator = {
	administrator: { id: string; username: string; email: string };
};

// suspend_tenant is the only outcome for the last administrator, and only allowed for them.
export type RevokeAdministratorValues =
	| { outcome: 'change_role'; roleCode: string; reason: string }
	| { outcome: 'remove' | 'suspend_tenant'; reason: string };

export type RevokedAdministrator = { tenantSuspended: boolean };
