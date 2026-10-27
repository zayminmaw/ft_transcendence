import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organizations';
import { ActivityController } from './activity.controller';
import { ActivityRepository } from './activity.repository';
import { ActivityService } from './activity.service';
import { TenantAdministratorsController } from './tenant-administrators.controller';
import { TenantAdministratorsRepository } from './tenant-administrators.repository';
import { TenantAdministratorsService } from './tenant-administrators.service';
import { TenantsController } from './tenants.controller';
import { TenantsRepository } from './tenants.repository';
import { TenantsService } from './tenants.service';

// Platform administration: managing the companies (tenants) that use Transcend.
@Module({
  imports: [TypeOrmModule.forFeature([Organization])],
  controllers: [TenantsController, TenantAdministratorsController, ActivityController],
  providers: [
    TenantsRepository, TenantsService, TenantAdministratorsRepository, TenantAdministratorsService, ActivityRepository, ActivityService,
  ],
})
export class PlatformModule {}
