import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { UserRole } from './entities/user-role.entity';

export const PLATFORM_ADMIN_ROLE = 'platform_admin';

@Injectable()
export class PlatformRolesRepository {
  constructor(@InjectRepository(UserRole) private readonly userRoles: Repository<UserRole>) {}

  // Platform access comes only from user_roles, never from a company membership or header.
  hasPlatformAccess(userId: string): Promise<boolean> {
    return this.userRoles.exists({ where: { userId, role: { code: PLATFORM_ADMIN_ROLE } }, relations: { role: true } });
  }

  async grantPlatformAdmin(userId: string, manager: EntityManager = this.userRoles.manager): Promise<void> {
    const role = await manager.findOneBy(Role, { code: PLATFORM_ADMIN_ROLE });
    if (!role) throw new Error('The platform_admin role is missing. Run the migrations first.');
    await manager.insert(UserRole, { userId, roleId: role.id });
  }
}
