import { PLATFORM_ADMIN_ROLE } from "../rbac";
import type { TenantListQuery } from "./types/tenant";

export const TENANT_ADMIN_ROLE = "org_admin";

// Roles a revoked administrator can never be moved to. Every other role in the database is offered.
export const NON_MEMBER_ROLES = [TENANT_ADMIN_ROLE, PLATFORM_ADMIN_ROLE];

// What happens to a revoked administrator. suspend_tenant is the only choice, and only allowed, for the last one.
export const REVOKE_OUTCOMES = [
	"change_role",
	"remove",
	"suspend_tenant",
] as const;

// The "existing member" choice lists at most this many members; a search narrows it.
export const CANDIDATE_LIMIT = 50;

// Error bodies for the tenant routes. The codes are what the frontend matches on.
export const TENANT_CONFLICTS = {
	slug: {
		message: "Another company already uses that slug.",
		code: "TENANT_SLUG_TAKEN",
	},
	username: {
		message: "That username already belongs to an account.",
		code: "USERNAME_TAKEN",
	},
	email: {
		message: "That email already belongs to an account.",
		code: "EMAIL_TAKEN",
	},
} as const;

export const TENANT_NOT_FOUND = {
	message: "Tenant not found.",
	code: "TENANT_NOT_FOUND",
};

export const TENANT_ALREADY_ACTIVE = {
	message: "The tenant is already active.",
	code: "TENANT_ALREADY_ACTIVE",
};

export const TENANT_ALREADY_SUSPENDED = {
	message: "The tenant is already suspended.",
	code: "TENANT_ALREADY_SUSPENDED",
};

export const TENANT_HAS_NO_ADMINISTRATOR = {
	message: "Assign an administrator before reactivating the tenant.",
	code: "TENANT_HAS_NO_ADMINISTRATOR",
};

export const ADMINISTRATOR_PROBLEMS = {
	member_not_found: {
		message: "That person is not a member of this company.",
		code: "MEMBER_NOT_FOUND",
	},
	already_administrator: {
		message: "That person is already an administrator of this company.",
		code: "ALREADY_ADMINISTRATOR",
	},
	administrator_not_found: {
		message: "That person is not an administrator of this company.",
		code: "ADMINISTRATOR_NOT_FOUND",
	},
	last_administrator: {
		message:
			"This is the company's last administrator. Revoking them suspends the tenant.",
		code: "LAST_ADMINISTRATOR",
	},
	role_not_available: {
		message: "That role is not available in this company.",
		code: "ROLE_NOT_AVAILABLE",
	},
	not_last_administrator: {
		message:
			"Other administrators remain, so the tenant is not suspended. Choose what happens to this administrator.",
		code: "NOT_LAST_ADMINISTRATOR",
	},
} as const;

// The list's sort keys and the SQL each one orders by; only these columns can reach ORDER BY.
export const SORT_COLUMNS: Record<TenantListQuery["sort"], string> = {
	name: "organization.name",
	members: "`activeMembers`",
	createdAt: "organization.createdAt",
};

// The activity page's action filter and the audit actions each one shows. Only these values reach the query.
export const ACTIVITY_ACTIONS = {
	created: ["tenant.create"],
	details: ["tenant.update"],
	status: ["tenant.suspend", "tenant.reactivate"],
	administrators: [
		"tenant.administrator.assign",
		"tenant.administrator.revoke",
	],
} as const;

export const ACTIVITY_FILTERS = [
	"all",
	...(Object.keys(ACTIVITY_ACTIONS) as (keyof typeof ACTIVITY_ACTIONS)[]),
] as const;

export const ACTIVITY_SORTS = ["createdAt", "tenant"] as const;

export const ACTIVITY_SORT_COLUMNS: Record<
	(typeof ACTIVITY_SORTS)[number],
	string
> = { createdAt: "log.createdAt", tenant: "organization.name" };

// The activity counts cover this many days.
export const ACTIVITY_COUNT_DAYS = 7;
