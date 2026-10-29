import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from '../organizations';
import { UsersModule } from '../users';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';
import { PermissionPolicyService } from './permission-policy.service';
import { PermissionsRepository } from './permissions.repository';
import { PlatformRolesRepository } from './platform-roles.repository';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [OrganizationsModule, UsersModule, TypeOrmModule.forFeature([UserRole, RolePermission])],
  providers: [PermissionsRepository, PermissionPolicyService, PlatformRolesRepository, RolesGuard],
  exports: [RolesGuard, PlatformRolesRepository, PermissionsRepository, PermissionPolicyService],
})
export class RbacModule {}
