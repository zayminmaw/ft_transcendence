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

  listActiveWorkspaces(userId: string) {
    return this.members.findActiveWorkspaces(userId);
  }
}
