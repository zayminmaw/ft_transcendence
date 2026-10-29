import { AUDIT_RESOURCES } from './audit-resources';
import { maskForPlatform } from './audit-values';
import type { AuditLog } from './entities/audit-log.entity';

export interface AuditChange {
	before: unknown;
	after: unknown;
}

// What every audit screen receives. Values were redacted when the row was written.
// withNetwork false hides where the actor connected from (a platform administrator's IP is not the tenant's business).
// forPlatform masks personal data, which only the company itself may see.
export function auditLogView(
	row: AuditLog,
	options: { withChanges: boolean; withUserAgent?: boolean; withNetwork?: boolean; forPlatform?: boolean },
) {
	const withNetwork = options.withNetwork ?? true;
	return {
		id: row.id,
		occurredAt: new Date(row.occurredAt).toISOString(),
		organizationId: row.organizationId,
		actor: { id: row.userId, name: row.actorName, role: row.actorRole, type: row.actorType },
		module: row.module,
		action: row.action,
		resource: { type: row.resourceType, id: row.recordId, label: row.resourceLabel },
		params: row.metadata ?? {},
		changes: options.withChanges ? changes(row, options.forPlatform ?? false) : null,
		category: row.category,
		severity: row.severity,
		outcome: row.outcome,
		source: row.source,
		ip: withNetwork ? row.ipAddress : null,
		requestId: row.requestId,
		...(options.withUserAgent ? { userAgent: withNetwork ? row.userAgent : null } : {}),
	};
}

function changes(row: AuditLog, forPlatform: boolean): Record<string, AuditChange> | null {
	let before = row.oldValues ?? {};
	let after = row.newValues ?? {};
	if (forPlatform) {
		// Without the resource's rules nothing says which fields are personal: show none.
		const rules = row.resourceType ? AUDIT_RESOURCES[row.resourceType]?.fields : undefined;
		if (!rules) return null;
		before = maskForPlatform(rules, before);
		after = maskForPlatform(rules, after);
	}
	const result: Record<string, AuditChange> = {};
	for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
		result[field] = { before: before[field] ?? null, after: after[field] ?? null };
	}
	return result;
}
