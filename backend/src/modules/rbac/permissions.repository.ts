import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RolePermission } from './entities/role-permission.entity';

@Injectable()
export class PermissionsRepository {
  constructor(@InjectRepository(RolePermission) private readonly rolePermissions: Repository<RolePermission>) {}

  async findScope(roleId: string, permission: string): Promise<'all' | 'assigned_only' | undefined> {
    const grant = await this.rolePermissions.findOne({
      where: { roleId: Number(roleId), permission: { code: permission } },
      relations: { permission: true },
    });
    return grant?.scope;
  }

  // The codes each role may use, by role code, with the guard's rule: only full-scope permissions (it refuses
  // assigned_only until ownership rules exist). For /me, so the interface offers only what the API allows.
  async grantedCodes(roleCodes: string[]): Promise<Record<string, string[]>> {
    const granted: Record<string, string[]> = Object.fromEntries(roleCodes.map((code) => [code, []]));
    if (roleCodes.length === 0) return granted;
    const grants = await this.rolePermissions.find({
      where: { scope: 'all', role: { code: In(roleCodes) } },
      relations: { role: true, permission: true },
      order: { permission: { code: 'ASC' } },
    });
    for (const grant of grants) granted[grant.role.code].push(grant.permission.code);
    return granted;
  }
}
