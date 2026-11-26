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
	counts: { total: number; active: number; suspended: number; members: number };
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

// A member who can be made an administrator. A removed member (left the company) is brought back by assigning.
export type TenantMember = {
	id: string;
	username: string;
	email: string;
	role: { code: string; name: string };
	removed: boolean;
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

export type ActivityFilter = 'all' | 'created' | 'details' | 'status' | 'administrators';

export type ActivitySortKey = 'createdAt' | 'tenant';

export type TenantActivityParams = {
	search: string;
	action: ActivityFilter;
	sort: ActivitySortKey;
	direction: 'asc' | 'desc';
	page: number;
	pageSize: number;
};

// What an event shows; which fields are set depends on the action.
export type ActivityDetails = {
	reason?: string | null;
	administrator?: string;
	account?: 'new' | 'existing';
	revoke?: 'change_role' | 'remove';
	role?: string;
	previousRole?: string;
	fields?: string[];
	cause?: 'last_administrator_revoked';
};

export type TenantActivityEvent = {
	id: string;
	createdAt: string;
	action: string;
	// Null only if the company has since been deleted.
	tenant: { id: string; name: string } | null;
	actor: string | null;
	details: ActivityDetails;
};

export type TenantActivity = {
	items: TenantActivityEvent[];
	total: number;
	page: number;
	pageSize: number;
	// The last seven days, whatever the search and filter.
	counts: {
		events: number;
		created: number;
		details: number;
		status: number;
		administrators: number;
	};
};

// GET /api/platform/signins: sign-in counts across the whole platform. Counts only, no names, IPs or companies.
// Days are UTC dates written as YYYY-MM-DD, the first is the start of the range and the last is today.
export const SIGNINS_RANGES = [7, 30, 90] as const;
export type SigninsRange = (typeof SIGNINS_RANGES)[number];
export const SIGNINS_DEFAULT_RANGE: SigninsRange = 30;

export type SigninDay = {
	day: string;
	signIns: number;
	failedSignIns: number;
	sessionReuse: number;
};

export type PlatformSignins = {
	range: SigninsRange;
	from: string;
	to: string;
	// The failure rate is a percentage with one decimal, 0 when there were no attempts.
	totals: { signIns: number; failedSignIns: number; failureRate: number; sessionReuse: number };
	// One entry for every day of the range, zeros included.
	days: SigninDay[];
};
