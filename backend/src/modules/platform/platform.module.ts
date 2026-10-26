import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organizations';
import { TenantAdministratorsController } from './tenant-administrators.controller';
import { TenantAdministratorsRepository } from './tenant-administrators.repository';
import { TenantAdministratorsService } from './tenant-administrators.service';
import { TenantsController } from './tenants.controller';
import { TenantsRepository } from './tenants.repository';
import { TenantsService } from './tenants.service';

// Platform administration: managing the companies (tenants) that use Transcend.
@Module({
  imports: [TypeOrmModule.forFeature([Organization])],
  controllers: [TenantsController, TenantAdministratorsController],
  providers: [TenantsRepository, TenantsService, TenantAdministratorsRepository, TenantAdministratorsService],
})
export class PlatformModule {}
