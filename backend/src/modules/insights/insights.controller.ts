import { Controller, Get, Query, Req, UseFilters } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { AuditService } from '../audit';
import { InsightsQueryDto } from './dto/insights-query.dto';
import { InsightsReadDeniedFilter } from './insights-read-denied.filter';
import { InsightsService } from './insights.service';

// One read endpoint. It uses the audit trail's permission, so whoever may read the trail may read the counts about
// it, and every read is audited too.
@Controller()
export class InsightsController {
  constructor(private readonly insights: InsightsService, private readonly audit: AuditService) {}

  @Get('activity-insights')
  @RequirePermission('admin.audit_logs')
  @UseFilters(InsightsReadDeniedFilter)
  async read(@Query() query: InsightsQueryDto, @Req() request: AuthenticatedRequest) {
    // The company comes from the verified membership, never from a query value.
    const result = await this.insights.read(request.tenant!.organizationId, query.range);
    await this.audit.recordStandalone({
      module: 'insights', action: 'read', resourceType: 'activity_insight', params: { range: query.range },
    });
    return result;
  }
}
