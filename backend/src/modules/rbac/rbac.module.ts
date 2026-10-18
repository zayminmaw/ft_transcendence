import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations';
import { UsersModule } from '../users';
import { PermissionsRepository } from './permissions.repository';
import { PlatformRolesRepository } from './platform-roles.repository';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [OrganizationsModule, UsersModule],
  providers: [PermissionsRepository, PlatformRolesRepository, RolesGuard],
  exports: [RolesGuard, PlatformRolesRepository],
})
export class RbacModule {}
