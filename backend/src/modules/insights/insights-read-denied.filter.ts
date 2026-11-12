import { type ArgumentsHost, Catch, type ExceptionFilter, ForbiddenException, Injectable } from '@nestjs/common';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { AuditService } from '../audit';
import { OrganizationMembersService } from '../organizations';

// Someone tried to open the insights page without the right to: that attempt is itself audited, the way a denied
// read of the audit trail is. The answer stays the usual 403 from the global filter.
@Catch(ForbiddenException)
@Injectable()
export class InsightsReadDeniedFilter implements ExceptionFilter {
  private readonly fallback = new HttpExceptionFilter();

  constructor(private readonly audit: AuditService, private readonly members: OrganizationMembersService) {}

  async catch(error: ForbiddenException, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<AuthenticatedRequest>();
    await this.audit.recordStandalone({
      module: 'insights', action: 'read', resourceType: 'activity_insight', outcome: 'denied',
      organizationId: await this.company(request),
    }).catch(() => undefined);
    this.fallback.catch(error, host);
  }

  // The company the person asked about, so its administrators see the attempt. A header is only a claim: it counts
  // when the person really is an active member there.
  private async company(request: AuthenticatedRequest): Promise<string | null> {
    const header = request.headers['x-organization-id'];
    const userId = request.user?.id;
    if (!userId || typeof header !== 'string' || !/^[1-9]\d*$/.test(header)) return null;
    return (await this.members.isActiveMember(userId, header).catch(() => false)) ? header : null;
  }
}
