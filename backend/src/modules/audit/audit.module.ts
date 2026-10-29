import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditReadDeniedFilter } from './audit-read-denied.filter';
import { AuditController } from './audit.controller';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

// The audit trail: one writer (AuditService) and one set of read endpoints for every module.
@Module({
	imports: [TypeOrmModule.forFeature([AuditLog])],
	controllers: [AuditController],
	providers: [AuditService, AuditRepository, AuditReadDeniedFilter],
	exports: [AuditService],
})
export class AuditModule {}
