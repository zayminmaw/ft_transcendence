import { type ArgumentsHost, Catch, type ExceptionFilter, ForbiddenException, Injectable } from '@nestjs/common';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

// Someone tried to read the audit trail without the right to: that attempt is itself audited. The answer stays the
// usual 403 from the global filter.
@Catch(ForbiddenException)
@Injectable()
export class AuditReadDeniedFilter implements ExceptionFilter {
	private readonly fallback = new HttpExceptionFilter();

	constructor(private readonly audit: AuditService, private readonly logs: AuditRepository) {}

	async catch(error: ForbiddenException, host: ArgumentsHost) {
		const request = host.switchToHttp().getRequest<AuthenticatedRequest>();
		await this.audit.recordStandalone({
			module: 'audit', action: 'read', resourceType: 'audit_log', outcome: 'denied',
			organizationId: await this.company(request),
		}).catch(() => undefined);
		this.fallback.catch(error, host);
	}

	// The company the person asked about, so its administrators see the attempt. A header is only a claim: it counts
	// when the person really is an active member there.
	protected async company(request: AuthenticatedRequest): Promise<string | null> {
		const header = request.headers['x-organization-id'];
		const userId = request.user?.id;
		if (!userId || typeof header !== 'string' || !/^[1-9]\d*$/.test(header)) return null;
		return (await this.logs.isActiveMember(userId, header).catch(() => false)) ? header : null;
	}
}

// A refused read of the platform trail belongs to no company, so it is recorded with none. Otherwise a company's
// administrators would see it, and the activity counts would include it, because the company header only needs the
// caller to be an active member there.
@Catch(ForbiddenException)
@Injectable()
export class PlatformAuditReadDeniedFilter extends AuditReadDeniedFilter {
	protected override company(): Promise<string | null> {
		return Promise.resolve(null);
	}
}
