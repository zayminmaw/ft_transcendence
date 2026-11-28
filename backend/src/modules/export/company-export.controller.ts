import { Controller, Get, Query, Req, Res, UseFilters } from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { AuditService } from '../audit';
import { CompanyExportDeniedFilter } from './company-export-denied.filter';
import { CompanyExportService } from './company-export.service';
import { CompanyExportQueryDto } from './dto/company-export-query.dto';

// Strictly Tenant Admin only: `admin.manage_users` is held exclusively by org_admin.
// Every query inside CompanyExportService is scoped to request.tenant!.organizationId.
@Controller('company-export')
@RequirePermission('admin.manage_users')
export class CompanyExportController {
  constructor(
    private readonly companyExport: CompanyExportService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @UseFilters(CompanyExportDeniedFilter)
  async download(
    @Query() query: CompanyExportQueryDto,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const organizationId = request.tenant!.organizationId;
    const file = await this.companyExport.generate(organizationId, query.format, query.section);

    await this.audit.recordStandalone({
      module: 'export',
      action: 'read',
      resourceType: 'company_export',
      organizationId,
      params: { format: query.format, section: query.section },
    });

    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    response.send(file.body);
  }
}
