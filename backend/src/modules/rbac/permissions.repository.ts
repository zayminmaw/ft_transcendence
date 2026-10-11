import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class PermissionsRepository {
  constructor(private readonly database: DataSource) {}

  async findScope(roleId: string, permission: string): Promise<'all' | 'assigned_only' | undefined> {
    const rows: { scope: 'all' | 'assigned_only' }[] = await this.database.query(
      `SELECT rp.scope FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ? AND p.code = ? LIMIT 1`, [roleId, permission],
    );
    return rows[0]?.scope;
  }
}
