import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyActivityDay } from './entities/company-activity-day.entity';
import { InsightsRepository } from './insights.repository';

// The activity table and its queries on their own, so the notifications module can record activity without importing
// the endpoint and its dependencies (the pattern of ContactsStoreModule).
@Module({
  imports: [TypeOrmModule.forFeature([CompanyActivityDay])],
  providers: [InsightsRepository],
  exports: [InsightsRepository],
})
export class InsightsStoreModule {}
