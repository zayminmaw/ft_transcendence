import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../../common/decorators/public.decorator';
import { REQUIRED_PERMISSION } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { OrganizationMembersService } from '../organizations';
import { PermissionsRepository } from './permissions.repository';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly members: OrganizationMembersService, private readonly permissions: PermissionsRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const permission = this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION, targets);
    if (!permission) throw new ForbiddenException('This endpoint has no configured permission.');
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const organizationId = request.headers['x-organization-id'];
    if (typeof organizationId !== 'string' || !/^[1-9]\d*$/.test(organizationId)) {
      throw new BadRequestException('X-Organization-Id must be a positive integer.');
    }
    if (!request.user) throw new ForbiddenException('Authentication is required.');
    const tenant = await this.members.requireActiveMembership(request.user.id, organizationId);
    const scope = await this.permissions.findScope(tenant.roleId, permission);
    // Resource ownership policies must be implemented before enabling assigned-only actions.
    if (scope !== 'all') throw new ForbiddenException('The requested permission is not available.');
    request.tenant = tenant;
    return true;
  }
}
