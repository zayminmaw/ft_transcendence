import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { AuditLog } from './entities/audit-log.entity';

// Who is reading decides which rows exist for them. Always set by the server, never by the query.
export type AuditScope =
	| { kind: 'tenant'; organizationId: string }
	| { kind: 'actor'; userId: string }
	| { kind: 'platform' };

export interface AuditPage {
	items: AuditLog[];
	total: number;
	page: number;
	pageSize: number;
}

@Injectable()
export class AuditRepository {
	constructor(@InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>) {}

	async list(scope: AuditScope, query: ListAuditLogsDto): Promise<AuditPage> {
		const builder = this.scoped(scope);
		// Reads of the trail are recorded but would bury the changes people come for: shown only when asked for.
		if (query.module !== 'audit' && query.resourceType !== 'audit_log') builder.andWhere("log.category <> 'access'");
		if (query.module) builder.andWhere('log.module = :module', { module: query.module });
		if (query.resourceType) builder.andWhere('log.resourceType = :resourceType', { resourceType: query.resourceType });
		if (query.recordId) builder.andWhere('log.recordId IN (:...recordIds)', { recordIds: query.recordId.split(',') });
		if (query.action) builder.andWhere('log.action = :action', { action: query.action });
		if (query.userId) builder.andWhere('log.userId = :userId', { userId: query.userId });
		if (query.from) builder.andWhere('log.occurredAt >= :from', { from: new Date(query.from) });
		if (query.to) builder.andWhere('log.occurredAt <= :to', { to: new Date(query.to) });
		const [items, total] = await builder
			.orderBy('log.occurredAt', 'DESC')
			.addOrderBy('log.id', 'DESC')
			.skip((query.page - 1) * query.pageSize)
			.take(query.pageSize)
			.getManyAndCount();
		return { items, total, page: query.page, pageSize: query.pageSize };
	}

	// For a refused read: the company header counts only if the person really is an active member there.
	async isActiveMember(userId: string, organizationId: string): Promise<boolean> {
		const rows: unknown[] = await this.auditLogs.query(
			'SELECT 1 FROM organization_members WHERE user_id = ? AND organization_id = ? AND is_active = TRUE LIMIT 1',
			[userId, organizationId],
		);
		return rows.length > 0;
	}

	find(scope: AuditScope, id: string): Promise<AuditLog | null> {
		return this.scoped(scope).andWhere('log.id = :id', { id }).getOne();
	}

	private scoped(scope: AuditScope): SelectQueryBuilder<AuditLog> {
		const builder = this.auditLogs.createQueryBuilder('log');
		if (scope.kind === 'tenant') return builder.where('log.organizationId = :organizationId', { organizationId: scope.organizationId });
		if (scope.kind === 'actor') return builder.where('log.userId = :userId', { userId: scope.userId });
		return builder.where('1 = 1');
	}
}
