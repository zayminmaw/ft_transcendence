import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { OrganizationsModule } from '../organizations';
import { InsightsReadDeniedFilter } from './insights-read-denied.filter';
import { InsightsStoreModule } from './insights-store.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

// The activity insights endpoint for company admins. Recording lives in InsightsStoreModule, which the notifications
// module imports without pulling this one in.
@Module({
  imports: [InsightsStoreModule, AuditModule, OrganizationsModule],
  controllers: [InsightsController],
  providers: [InsightsService, InsightsReadDeniedFilter],
})
export class InsightsModule {}
