import type { RequestMeta } from '../../common/context/request-meta';

// The verb. The noun is resourceType, so "invoice" + "status_change" reads "changed the status of an invoice".
// Auth keeps its established names; add a verb here only when none of these fits.
export const AUDIT_ACTIONS = [
	'create', 'update', 'delete', 'status_change', 'transfer', 'assign', 'revoke',
	'login', 'login_failed', 'logout', 'session_reuse', 'password_changed', 'password_reset',
	'read',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_CATEGORIES = ['data', 'security', 'platform', 'access'] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_SEVERITIES = ['info', 'notice', 'warning', 'critical'] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export type AuditOutcome = 'success' | 'failure' | 'denied';
export type AuditActorType = 'user' | 'system' | 'cli';
export type AuditSource = 'web' | 'api' | 'cli' | 'system';

export interface AuditEntry {
	// Owning module, e.g. 'billing'. Lets a module find its own history.
	module: string;
	action: AuditAction;
	// A key of AUDIT_RESOURCES: it decides which fields may be stored and how.
	resourceType: string;
	recordId?: string | null;
	// What people call the record, e.g. "INV-2026-0017" or a username. Shown as-is, so no other personal data.
	resourceLabel?: string | null;
	// Defaults to the verified tenant of the request.
	organizationId?: string | null;
	// Defaults to the signed-in user. Login passes the account it is about, since nobody is signed in yet.
	actorId?: string | null;
	actorType?: AuditActorType;
	// Entity snapshots, not request bodies: only the resource's allowlisted fields are kept.
	before?: object | null;
	after?: object | null;
	// Extra words for the description, e.g. { installment: 'Final Payment' }. Short scalars only.
	params?: Record<string, string | number | boolean | null>;
	outcome?: AuditOutcome;
	severity?: AuditSeverity;
	// Defaults to the current request; pass it where a service already has it, or outside a request.
	meta?: RequestMeta;
}

// What listeners (alerts, notifications) receive once the row is committed.
export interface AuditEvent {
	id: string;
	occurredAt: string;
	organizationId: string | null;
	actorId: string | null;
	module: string;
	action: AuditAction;
	resourceType: string;
	recordId: string | null;
	category: AuditCategory;
	severity: AuditSeverity;
	outcome: AuditOutcome;
}
