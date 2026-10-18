import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { TenantContext } from '../../common/types/authenticated-request';
import { OrganizationMember } from './entities/organization-member.entity';

export interface Workspace {
  id: string;
  slug: string;
  name: string;
}

@Injectable()
export class OrganizationMembersRepository {
  constructor(
    private readonly database: DataSource,
    @InjectRepository(OrganizationMember) private readonly members: Repository<OrganizationMember>,
  ) {}

  // Bootstrap raw query from the scaffold; it moves to the entities with the roles task.
  async findActiveMembership(userId: string, organizationId: string): Promise<TenantContext | undefined> {
    const rows: { roleId: string }[] = await this.database.query(
      `SELECT CAST(m.role_id AS CHAR) AS roleId FROM organization_members m
       JOIN organizations o ON o.id = m.organization_id
       JOIN users u ON u.id = m.user_id
       WHERE m.user_id = ? AND m.organization_id = ?
       AND m.is_active = TRUE AND o.is_active = TRUE AND u.is_active = TRUE LIMIT 1`,
      [userId, organizationId],
    );
    return rows[0] ? { organizationId, roleId: rows[0].roleId } : undefined;
  }

  // The workspace picker: active memberships in active companies only.
  async findActiveWorkspaces(userId: string): Promise<Workspace[]> {
    const memberships = await this.members.find({
      where: { userId, isActive: true, organization: { isActive: true } },
      relations: { organization: true },
      order: { organization: { name: 'ASC' } },
    });
    return memberships.map(({ organization }) => ({ id: organization.id, slug: organization.slug, name: organization.name }));
  }
}
