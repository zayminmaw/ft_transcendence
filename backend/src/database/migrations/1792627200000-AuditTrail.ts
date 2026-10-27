import type { MigrationInterface, QueryRunner } from 'typeorm';
import { defaultSeverity, retainUntil } from '../../modules/audit/audit-policy';
import { auditResource } from '../../modules/audit/audit-resources';
import { auditValues } from '../../modules/audit/audit-values';
import type { AuditAction, AuditOutcome } from '../../modules/audit/audit.types';

interface LegacyRow {
	id: string;
	module: string;
	action: string;
	old_values: unknown;
	new_values: unknown;
	created_at: Date;
}

// Rows written before the shared vocabulary: [resource, verb, before, after] for each old action name.
const LEGACY: Record<string, (row: LegacyRow) => [string, AuditAction, object | null, object | null]> = {
	'auth:login': () => ['user', 'login', null, null],
	'auth:login_failed': () => ['user', 'login_failed', null, null],
	'auth:password_changed': () => ['user', 'password_changed', null, null],
	'auth:logout': () => ['session', 'logout', null, null],
	'auth:session_reuse': () => ['session', 'session_reuse', null, null],
	'members:member_created': (row) => ['member', 'create', null, json(row.new_values)],
	'members:member_deactivated': () => ['member', 'status_change', { isActive: true }, { isActive: false }],
	'members:member_reactivated': () => ['member', 'status_change', { isActive: false }, { isActive: true }],
	'members:password_reset': () => ['member', 'password_reset', null, null],
	'platform:tenant.create': (row) => ['tenant', 'create', null, json(row.new_values)],
	'platform:tenant.update': (row) => ['tenant', 'update', json(row.old_values), json(row.new_values)],
	'platform:tenant.suspend': (row) => ['tenant', 'status_change', json(row.old_values), json(row.new_values)],
	'platform:tenant.reactivate': (row) => ['tenant', 'status_change', json(row.old_values), json(row.new_values)],
	'platform:tenant.administrator.assign': (row) => ['tenant_administrator', 'assign', json(row.old_values), json(row.new_values)],
	'platform:tenant.administrator.revoke': (row) => ['tenant_administrator', 'revoke', json(row.old_values), json(row.new_values)],
};

function json(value: unknown): object | null {
	if (typeof value === 'string') return JSON.parse(value) as object;
	return (value as object | null) ?? null;
}

// audit_logs becomes the one append-only audit trail: actor and request context, category, severity, outcome and
// retention, with rows that can't be changed and can't be deleted before their retention ends.
export class AuditTrail1792627200000 implements MigrationInterface {
	// MariaDB DDL commits implicitly.
	transaction = false;

	async up(queryRunner: QueryRunner): Promise<void> {
		// ON DELETE SET NULL would rewrite history without firing the triggers below: rows keep the ids instead.
		await queryRunner.query(`ALTER TABLE audit_logs
			DROP FOREIGN KEY fk_al_org,
			DROP FOREIGN KEY fk_al_user,
			ADD COLUMN actor_type ENUM('user','system','cli') NOT NULL DEFAULT 'user' AFTER user_id,
			ADD COLUMN actor_name VARCHAR(64) NULL AFTER actor_type,
			ADD COLUMN actor_role VARCHAR(64) NULL AFTER actor_name,
			ADD COLUMN resource_type VARCHAR(64) NULL AFTER action,
			ADD COLUMN resource_label VARCHAR(128) NULL AFTER record_id,
			ADD COLUMN category ENUM('data','security','platform','access') NOT NULL DEFAULT 'data' AFTER resource_label,
			ADD COLUMN severity ENUM('info','notice','warning','critical') NOT NULL DEFAULT 'info' AFTER category,
			ADD COLUMN outcome ENUM('success','failure','denied') NOT NULL DEFAULT 'success' AFTER severity,
			ADD COLUMN source ENUM('web','api','cli','system') NOT NULL DEFAULT 'web' AFTER outcome,
			ADD COLUMN request_id VARCHAR(64) NULL AFTER user_agent,
			ADD COLUMN metadata JSON NULL AFTER new_values,
			ADD COLUMN occurred_at DATETIME(3) NULL AFTER metadata,
			ADD COLUMN retain_until DATETIME NULL AFTER occurred_at`);

		// Bring existing rows to the shared vocabulary, keeping only allowlisted fields (secrets never).
		const rows = await queryRunner.query(
			'SELECT id, module, action, old_values, new_values, created_at FROM audit_logs',
		) as LegacyRow[];
		for (const row of rows) {
			const legacy = LEGACY[`${row.module}:${row.action}`];
			if (!legacy) continue;
			const [resourceType, action, before, after] = legacy(row);
			const resource = auditResource(resourceType);
			const outcome: AuditOutcome = action === 'login_failed' ? 'failure' : 'success';
			const severity = defaultSeverity(action, outcome);
			const values = auditValues(resource.fields, before, after, action === 'update');
			const occurredAt = new Date(row.created_at);
			await queryRunner.query(
				`UPDATE audit_logs SET action = ?, resource_type = ?, category = ?, severity = ?, outcome = ?,
					old_values = ?, new_values = ?, retain_until = ? WHERE id = ?`,
				[
					action, resourceType, resource.category, severity, outcome,
					values.oldValues && JSON.stringify(values.oldValues), values.newValues && JSON.stringify(values.newValues),
					retainUntil(occurredAt, resource.category, severity), row.id,
				],
			);
		}
		await queryRunner.query(`UPDATE audit_logs SET occurred_at = created_at WHERE occurred_at IS NULL`);
		await queryRunner.query(
			`UPDATE audit_logs SET retain_until = DATE_ADD(created_at, INTERVAL 365 DAY) WHERE retain_until IS NULL`,
		);

		// Older rows kept only the actor's id. Their current username is the best name left for them (no role: the role
		// they had then is unknown).
		await queryRunner.query(`UPDATE audit_logs a JOIN users u ON u.id = a.user_id
			SET a.actor_name = u.username WHERE a.actor_name IS NULL`);

		await queryRunner.query(`ALTER TABLE audit_logs
			MODIFY occurred_at DATETIME(3) NOT NULL,
			MODIFY retain_until DATETIME NOT NULL,
			DROP INDEX idx_audit_logs_organization_id,
			DROP INDEX idx_audit_logs_user_id,
			ADD INDEX idx_al_org_occurred (organization_id, occurred_at),
			ADD INDEX idx_al_user_occurred (user_id, occurred_at),
			ADD INDEX idx_al_resource (resource_type, record_id, occurred_at),
			ADD INDEX idx_al_action (action),
			ADD INDEX idx_al_request (request_id),
			ADD INDEX idx_al_retain (retain_until)`);

		// Append-only: nobody changes a row, and a row is deleted only once its retention has ended.
		await queryRunner.query(`CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs FOR EACH ROW
			SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only'`);
		await queryRunner.query(`CREATE TRIGGER audit_logs_retention BEFORE DELETE ON audit_logs FOR EACH ROW
			BEGIN
				IF OLD.retain_until >= UTC_TIMESTAMP() THEN
					SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs rows cannot be deleted before retain_until';
				END IF;
			END`);
	}

	// Old action names are not restored: the rows keep the shared vocabulary.
	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('DROP TRIGGER IF EXISTS audit_logs_retention');
		await queryRunner.query('DROP TRIGGER IF EXISTS audit_logs_no_update');
		await queryRunner.query('UPDATE audit_logs SET organization_id = NULL WHERE organization_id NOT IN (SELECT id FROM organizations)');
		await queryRunner.query('UPDATE audit_logs SET user_id = NULL WHERE user_id NOT IN (SELECT id FROM users)');
		await queryRunner.query(`ALTER TABLE audit_logs
			DROP INDEX idx_al_org_occurred,
			DROP INDEX idx_al_user_occurred,
			DROP INDEX idx_al_resource,
			DROP INDEX idx_al_action,
			DROP INDEX idx_al_request,
			DROP INDEX idx_al_retain,
			DROP COLUMN actor_type, DROP COLUMN actor_name, DROP COLUMN actor_role, DROP COLUMN resource_type,
			DROP COLUMN resource_label, DROP COLUMN category, DROP COLUMN severity, DROP COLUMN outcome, DROP COLUMN source,
			DROP COLUMN request_id, DROP COLUMN metadata, DROP COLUMN occurred_at, DROP COLUMN retain_until,
			ADD INDEX idx_audit_logs_organization_id (organization_id),
			ADD INDEX idx_audit_logs_user_id (user_id),
			ADD CONSTRAINT fk_al_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE SET NULL,
			ADD CONSTRAINT fk_al_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL`);
	}
}
