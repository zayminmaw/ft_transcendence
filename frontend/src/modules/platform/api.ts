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
