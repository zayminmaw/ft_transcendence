import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrganizationMembersRepository } from './organization-members.repository';

@Injectable()
export class OrganizationMembersService {
  constructor(private readonly members: OrganizationMembersRepository) {}

  async requireActiveMembership(userId: string, organizationId: string) {
    const membership = await this.members.findActiveMembership(userId, organizationId);
    if (!membership) throw new ForbiddenException('Active organization membership is required.');
    return membership;
  }

  // True while the membership, the company and the account are all active (what the guard checks on every request).
  async isActiveMember(userId: string, organizationId: string): Promise<boolean> {
    return !!(await this.members.findActiveMembership(userId, organizationId));
  }

  listActiveWorkspaces(userId: string) {
    return this.members.findActiveWorkspaces(userId);
  }
}
