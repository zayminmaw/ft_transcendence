import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { OrganizationsModule } from '../organizations';
import { CompanyExportDeniedFilter } from './company-export-denied.filter';
import { CompanyExportController } from './company-export.controller';
import { CompanyExportRepository } from './company-export.repository';
import { CompanyExportService } from './company-export.service';

@Module({
  imports: [AuditModule, OrganizationsModule],
  controllers: [CompanyExportController],
  providers: [CompanyExportRepository, CompanyExportService, CompanyExportDeniedFilter],
})
export class CompanyExportModule {}
