import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

export const PLATFORM_ADMIN_ROLE = 'platform_admin';

@Injectable()
export class PlatformRolesRepository {
  constructor(private readonly database: DataSource) {}

  // Platform access comes only from user_roles, never from a company membership or header.
  async hasPlatformAccess(userId: string): Promise<boolean> {
    const rows: unknown[] = await this.database.query(
      `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? AND r.code = ? LIMIT 1`,
      [userId, PLATFORM_ADMIN_ROLE],
    );
    return rows.length > 0;
  }

  async grantPlatformAdmin(userId: string, manager: EntityManager = this.database.manager): Promise<void> {
    const result: { affectedRows: number } = await manager.query(
      'INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = ?', [userId, PLATFORM_ADMIN_ROLE],
    );
    if (result.affectedRows !== 1) throw new Error('The platform_admin role is missing. Run the migrations first.');
  }
}
