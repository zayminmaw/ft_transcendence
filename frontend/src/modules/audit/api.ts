export const AUDIT_ACTIONS = [
	'create',
	'update',
	'delete',
	'status_change',
	'transfer',
	'assign',
	'revoke',
	'login',
	'login_failed',
	'logout',
	'session_reuse',
	'password_changed',
	'password_reset',
	'read',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditChange = { before: unknown; after: unknown };

// One audit entry as every audit endpoint returns it. Values were masked when the entry was written.
export type AuditEntry = {
	id: string;
	occurredAt: string;
	organizationId: string | null;
	actor: { id: string | null; name: string | null; role: string | null; type: string };
	module: string;
	action: AuditAction;
	resource: { type: string | null; id: string | null; label: string | null };
	params: Record<string, string | number | boolean | null>;
	// null on the platform view of a company's business data.
	changes: Record<string, AuditChange> | null;
	category: 'data' | 'security' | 'platform' | 'access';
	severity: 'info' | 'notice' | 'warning' | 'critical';
	outcome: 'success' | 'failure' | 'denied';
	source: string;
	ip: string | null;
	requestId: string | null;
	userAgent?: string | null;
};

export type AuditPage = {
	items: AuditEntry[];
	total: number;
	page: number;
	pageSize: number;
};

// One query for every screen: the company log, one record's history and "my activity".
export type AuditFilters = {
	module?: string;
	resourceType?: string;
	// One id, or several comma-separated (e.g. an invoice and its payment).
	recordId?: string;
	action?: AuditAction;
	from?: string;
	to?: string;
	page: number;
	pageSize: number;
};

export function auditSearch(filters: AuditFilters): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(filters)) {
		if (value !== undefined && value !== '') search.set(key, String(value));
	}
	return search.toString();
}
