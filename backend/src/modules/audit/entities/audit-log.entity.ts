import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
	AUDIT_CATEGORIES, AUDIT_SEVERITIES, type AuditActorType, type AuditCategory, type AuditOutcome, type AuditSeverity,
	type AuditSource,
} from '../audit.types';

// Mirrors the shared, append-only `audit_logs` table. Write through AuditService (or recordAudit) only: it fills in
// the actor, request context and retention, and keeps unlisted or sensitive fields out.
@Entity('audit_logs')
export class AuditLog {
	@PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
	id!: string;

	@Column({ name: 'organization_id', type: 'bigint', unsigned: true, nullable: true })
	organizationId!: string | null;

	// The actor. Not a foreign key: history keeps the id after the account is gone.
	@Column({ name: 'user_id', type: 'bigint', unsigned: true, nullable: true })
	userId!: string | null;

	@Column({ name: 'actor_type', type: 'enum', enum: ['user', 'system', 'cli'], default: 'user' })
	actorType!: AuditActorType;

	@Column({ name: 'actor_name', type: 'varchar', length: 64, nullable: true })
	actorName!: string | null;

	@Column({ name: 'actor_role', type: 'varchar', length: 64, nullable: true })
	actorRole!: string | null;

	@Column({ type: 'varchar', length: 64 })
	module!: string;

	@Column({ type: 'varchar', length: 64 })
	action!: string;

	@Column({ name: 'resource_type', type: 'varchar', length: 64, nullable: true })
	resourceType!: string | null;

	@Column({ name: 'record_id', type: 'varchar', length: 64, nullable: true })
	recordId!: string | null;

	@Column({ name: 'resource_label', type: 'varchar', length: 128, nullable: true })
	resourceLabel!: string | null;

	@Column({ type: 'enum', enum: AUDIT_CATEGORIES, default: 'data' })
	category!: AuditCategory;

	@Column({ type: 'enum', enum: AUDIT_SEVERITIES, default: 'info' })
	severity!: AuditSeverity;

	@Column({ type: 'enum', enum: ['success', 'failure', 'denied'], default: 'success' })
	outcome!: AuditOutcome;

	@Column({ type: 'enum', enum: ['web', 'api', 'cli', 'system'], default: 'web' })
	source!: AuditSource;

	@Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
	ipAddress!: string | null;

	@Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
	userAgent!: string | null;

	@Column({ name: 'request_id', type: 'varchar', length: 64, nullable: true })
	requestId!: string | null;

	@Column({ name: 'old_values', type: 'json', nullable: true })
	oldValues!: Record<string, unknown> | null;

	@Column({ name: 'new_values', type: 'json', nullable: true })
	newValues!: Record<string, unknown> | null;

	// Words for the description, e.g. { installment: 'Final Payment' }; the frontend translates the sentence.
	@Column({ type: 'json', nullable: true })
	metadata!: Record<string, unknown> | null;

	@Column({ name: 'occurred_at', type: 'datetime', precision: 3 })
	occurredAt!: Date;

	@Column({ name: 'retain_until', type: 'datetime' })
	retainUntil!: Date;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;
}
