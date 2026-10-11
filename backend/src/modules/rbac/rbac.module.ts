import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations';
import { PermissionsRepository } from './permissions.repository';
import { RolesGuard } from './roles.guard';

@Module({ imports: [OrganizationsModule], providers: [PermissionsRepository, RolesGuard], exports: [RolesGuard] })
export class RbacModule {}
