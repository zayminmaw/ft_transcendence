import type { EntityManager } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { currentActor, currentRequest, currentRequestId } from '../../common/context/request-context';
import { requestMeta } from '../../common/context/request-meta';
import { defaultSeverity, retainUntil } from './audit-policy';
import { auditPublisher } from './audit-publisher';
import { auditResource } from './audit-resources';
import { auditParams, auditValues } from './audit-values';
import type { AuditEntry, AuditEvent } from './audit.types';
import { AuditLog } from './entities/audit-log.entity';

interface ActorSnapshot {
	name: string | null;
	role: string | null;
}

// Name and role as they were at the time, so history still reads right after a rename, role change or deletion.
// The role is the company role of this request, else the account's platform role.
async function actorSnapshot(manager: EntityManager, actorId: string, roleId: string | null): Promise<ActorSnapshot> {
	const rows = await manager.query(
		`SELECT u.username AS name,
			COALESCE(
				(SELECT r.code FROM roles r WHERE r.id = ?),
				(SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id ORDER BY r.id LIMIT 1)
			) AS role
		FROM users u WHERE u.id = ?`,
		[roleId, actorId],
	) as ActorSnapshot[];
	return { name: rows[0]?.name ?? null, role: rows[0]?.role ?? null };
}

// Writes one audit row with the caller's manager: inside a transaction the row commits or rolls back with the
// change it describes. AuditService wraps this; plain functions that already hold a manager may call it directly.
export async function recordAudit(manager: EntityManager, entry: AuditEntry): Promise<void> {
	const resource = auditResource(entry.resourceType);
	const request = currentRequest();
	const context = currentActor();
	const actorId = entry.actorId !== undefined ? entry.actorId : context.userId;
	const organizationId = entry.organizationId !== undefined ? entry.organizationId : context.organizationId;
	const meta = entry.meta ?? (request ? requestMeta(request) : { ip: null, userAgent: null });
	const outcome = entry.outcome ?? 'success';
	const severity = entry.severity ?? defaultSeverity(entry.action, outcome);
	const actorType = entry.actorType ?? (actorId || request ? 'user' : 'system');
	const actor = actorId ? await actorSnapshot(manager, actorId, context.roleId) : { name: null, role: null };
	const { oldValues, newValues } = auditValues(resource.fields, entry.before, entry.after, entry.action === 'update');
	const occurredAt = new Date();

	const row: Partial<AuditLog> = {
		organizationId,
		userId: actorId,
		actorType,
		actorName: actor.name,
		actorRole: actor.role,
		module: entry.module,
		action: entry.action,
		resourceType: entry.resourceType,
		recordId: entry.recordId ?? null,
		// Sign-ins and other changes to your own account are labelled with your name, so they don't read "#6".
		resourceLabel: (entry.resourceLabel ?? (entry.recordId === actorId ? actor.name : null))?.slice(0, 128) ?? null,
		category: resource.category,
		severity,
		outcome,
		source: actorType === 'cli' ? 'cli' : request ? 'web' : 'system',
		ipAddress: meta.ip,
		userAgent: meta.userAgent,
		requestId: currentRequestId(),
		oldValues,
		newValues,
		metadata: auditParams(entry.params),
		occurredAt,
		retainUntil: retainUntil(occurredAt, resource.category, severity),
	};
	// JSON columns are typed as plain records, which TypeORM's deep-partial insert type can't follow.
	const result = await manager.insert(AuditLog, row as QueryDeepPartialEntity<AuditLog>);

	const event: AuditEvent = {
		id: String(result.identifiers[0]?.id),
		occurredAt: occurredAt.toISOString(),
		organizationId,
		actorId,
		module: entry.module,
		action: entry.action,
		resourceType: entry.resourceType,
		recordId: entry.recordId ?? null,
		category: resource.category,
		severity,
		outcome,
	};
	auditPublisher.enqueue(manager, event);
}
