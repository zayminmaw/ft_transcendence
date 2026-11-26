import { type ArgumentsHost, Catch, type ExceptionFilter, ForbiddenException, Injectable } from '@nestjs/common';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { AuditService } from '../audit';
import { OrganizationMembersService } from '../organizations';

// Audits denied attempts to export company data (e.g. non-admin tenant roles or platform_admin without org_admin).
@Catch(ForbiddenException)
@Injectable()
export class CompanyExportDeniedFilter implements ExceptionFilter {
  private readonly fallback = new HttpExceptionFilter();

  constructor(private readonly audit: AuditService, private readonly members: OrganizationMembersService) {}

  async catch(error: ForbiddenException, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<AuthenticatedRequest>();
    await this.audit.recordStandalone({
      module: 'export',
      action: 'read',
      resourceType: 'company_export',
      outcome: 'denied',
      organizationId: await this.company(request),
    }).catch(() => undefined);
    this.fallback.catch(error, host);
  }

  private async company(request: AuthenticatedRequest): Promise<string | null> {
    const header = request.headers['x-organization-id'];
    const userId = request.user?.id;
    if (!userId || typeof header !== 'string' || !/^[1-9]\d*$/.test(header)) return null;
    return (await this.members.isActiveMember(userId, header).catch(() => false)) ? header : null;
  }
}
