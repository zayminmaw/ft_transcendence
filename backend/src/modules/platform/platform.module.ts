import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organizations';
import { TenantsController } from './tenants.controller';
import { TenantsRepository } from './tenants.repository';
import { TenantsService } from './tenants.service';

// Platform administration: managing the companies (tenants) that use Transcend.
@Module({
  imports: [TypeOrmModule.forFeature([Organization])],
  controllers: [TenantsController],
  providers: [TenantsRepository, TenantsService],
})
export class PlatformModule {}
