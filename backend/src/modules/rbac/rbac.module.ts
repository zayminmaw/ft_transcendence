import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from '../organizations';
import { UsersModule } from '../users';
import { UserRole } from './entities/user-role.entity';
import { PermissionsRepository } from './permissions.repository';
import { PlatformRolesRepository } from './platform-roles.repository';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [OrganizationsModule, UsersModule, TypeOrmModule.forFeature([UserRole])],
  providers: [PermissionsRepository, PlatformRolesRepository, RolesGuard],
  exports: [RolesGuard, PlatformRolesRepository],
})
export class RbacModule {}
