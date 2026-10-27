import { Controller, Get, NotFoundException, Param, Query, Req, UseFilters } from '@nestjs/common';
import { Authenticated } from '../../common/decorators/authenticated.decorator';
import { PlatformAdmin } from '../../common/decorators/platform-admin.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { auditLogView } from './audit-log.view';
import { AuditReadDeniedFilter } from './audit-read-denied.filter';
import { type AuditScope, AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import type { AuditLog } from './entities/audit-log.entity';

const NOT_FOUND = { message: 'Audit entry not found.', code: 'AUDIT_NOT_FOUND' };
const FILTER_KEYS = ['module', 'resourceType', 'recordId', 'action', 'userId', 'from', 'to'] as const;

// The same endpoints serve every module: the company log, one record's history ("Inspect changes") and the
// details of one entry. Every read is audited too.
@Controller()
export class AuditController {
	constructor(private readonly audit: AuditService, private readonly logs: AuditRepository) {}

	@Get('audit-logs')
	@RequirePermission('admin.audit_logs')
	@UseFilters(AuditReadDeniedFilter)
	list(@Query() query: ListAuditLogsDto, @Req() request: AuthenticatedRequest) {
		return this.page({ kind: 'tenant', organizationId: request.tenant!.organizationId }, query, true);
	}

	// Lets the interface show audit buttons only to people who may use them. Refusing this check is not an attempt
	// to read the trail, so it is not audited (no AuditReadDeniedFilter).
	@Get('audit-logs/access')
	@RequirePermission('admin.audit_logs')
	access() {
		return { canRead: true };
	}

	// These two come before :id, so "access" and "mine" are never read as ids.
	@Get('audit-logs/mine')
	@Authenticated()
	@UseFilters(AuditReadDeniedFilter)
	mine(@Query() query: ListAuditLogsDto, @Req() request: AuthenticatedRequest) {
		return this.page({ kind: 'actor', userId: request.user!.id }, query, true);
	}

	@Get('audit-logs/:id')
	@RequirePermission('admin.audit_logs')
	@UseFilters(AuditReadDeniedFilter)
	detail(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
		return this.one({ kind: 'tenant', organizationId: request.tenant!.organizationId }, id);
	}

	@Get('platform/audit-logs')
	@PlatformAdmin()
	@UseFilters(AuditReadDeniedFilter)
	platformList(@Query() query: ListAuditLogsDto) {
		return this.page({ kind: 'platform' }, query, false);
	}

	@Get('platform/audit-logs/:id')
	@PlatformAdmin()
	@UseFilters(AuditReadDeniedFilter)
	platformDetail(@Param('id') id: string) {
		return this.one({ kind: 'platform' }, id);
	}

	private async page(scope: AuditScope, query: ListAuditLogsDto, tenantView: boolean) {
		const result = await this.logs.list(scope, query);
		await this.audit.recordStandalone({
			module: 'audit', action: 'read', resourceType: 'audit_log',
			params: { scope: scope.kind, results: result.items.length, filters: describeFilters(query) },
		});
		return { ...result, items: result.items.map((row) => auditLogView(row, {
			withChanges: tenantView || !isTenantData(row),
			withNetwork: showsNetwork(scope, row),
			forPlatform: scope.kind === 'platform',
		})) };
	}

	private async one(scope: AuditScope, id: string) {
		const row = /^[1-9]\d*$/.test(id) ? await this.logs.find(scope, id) : null;
		if (!row) throw new NotFoundException(NOT_FOUND);
		await this.audit.recordStandalone({
			module: 'audit', action: 'read', resourceType: 'audit_log', recordId: id, params: { scope: scope.kind },
		});
		return auditLogView(row, {
			withChanges: scope.kind !== 'platform' || !isTenantData(row),
			withUserAgent: true,
			withNetwork: showsNetwork(scope, row),
			forPlatform: scope.kind === 'platform',
		});
	}
}

// Platform access does not include a company's business data (System-Technical-Architecture §4): the platform sees
// that a tenant record changed, not the values.
function isTenantData(row: AuditLog): boolean {
	return row.category === 'data' && row.organizationId !== null;
}

// A company sees what platform staff changed in it, not where they connected from.
function showsNetwork(scope: AuditScope, row: AuditLog): boolean {
	return scope.kind !== 'tenant' || row.module !== 'platform';
}

function describeFilters(query: ListAuditLogsDto): string {
	return FILTER_KEYS.filter((key) => query[key]).map((key) => `${key}=${query[key]}`).join('&');
}
