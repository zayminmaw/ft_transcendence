import type { AuditAction, AuditCategory, AuditOutcome, AuditSeverity } from './audit.types';

const DAY_MS = 24 * 60 * 60 * 1000;

// Kept long enough to investigate an incident or answer a dispute, and no longer. Rows inside their window can't be
// deleted (see the audit_logs triggers); a later purge job removes rows past it.
export const RETENTION_DAYS = { security: 365, data: 180, platform: 180, access: 90 } as const;

export function defaultSeverity(action: AuditAction, outcome: AuditOutcome): AuditSeverity {
	if (action === 'session_reuse') return 'critical';
	if (action === 'login_failed' || outcome === 'denied') return 'warning';
	if (action === 'delete' || action === 'revoke' || action === 'password_reset') return 'notice';
	return 'info';
}

export function retainUntil(occurredAt: Date, category: AuditCategory, severity: AuditSeverity): Date {
	const days = severity === 'critical' ? RETENTION_DAYS.security : RETENTION_DAYS[category];
	return new Date(occurredAt.getTime() + days * DAY_MS);
}
