import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TenantContext } from '../../common/types/authenticated-request';
import { OrganizationMember } from './entities/organization-member.entity';

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  // The person's role in this company, shown next to their name in the sidebar.
  role: { code: string; name: string };
}

@Injectable()
export class OrganizationMembersRepository {
  constructor(@InjectRepository(OrganizationMember) private readonly members: Repository<OrganizationMember>) {}

  // Every company request: the membership, the company and the account must all be active.
  async findActiveMembership(userId: string, organizationId: string): Promise<TenantContext | undefined> {
    const membership = await this.members.findOne({
      where: { userId, organizationId, isActive: true, organization: { isActive: true }, user: { isActive: true } },
      relations: { organization: true, user: true },
    });
    return membership ? { organizationId, roleId: String(membership.roleId) } : undefined;
  }

  // The workspace picker and the sidebar: active memberships in active companies only, each with the person's role.
  async findActiveWorkspaces(userId: string): Promise<Workspace[]> {
    const memberships = await this.members.find({
      where: { userId, isActive: true, organization: { isActive: true } },
      relations: { organization: true, role: true },
      order: { organization: { name: 'ASC' } },
    });
    return memberships.map(({ organization, role }) => ({
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
      role: { code: role.code, name: role.name },
    }));
  }
}
