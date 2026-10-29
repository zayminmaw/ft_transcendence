import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Matches, Max, Min } from 'class-validator';
import { AUDIT_ACTIONS, type AuditAction } from '../audit.types';

const KEY = /^[a-z][a-z0-9_]{0,63}$/;

// One query for every screen: the company log, one record's history (resourceType + recordId) and "my activity".
export class ListAuditLogsDto {
	@IsOptional()
	@Matches(KEY)
	module?: string;

	@IsOptional()
	@Matches(KEY)
	resourceType?: string;

	// Up to 20 ids, comma-separated, e.g. an invoice and its payment.
	@IsOptional()
	@Matches(/^[\w.-]{1,64}(,[\w.-]{1,64}){0,19}$/)
	recordId?: string;

	@IsOptional()
	@IsIn(AUDIT_ACTIONS)
	action?: AuditAction;

	@IsOptional()
	@Matches(/^[1-9]\d*$/)
	userId?: string;

	@IsOptional()
	@IsISO8601({ strict: true })
	from?: string;

	@IsOptional()
	@IsISO8601({ strict: true })
	to?: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page = 1;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	pageSize = 25;
}
