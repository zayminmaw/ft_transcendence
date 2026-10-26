import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_AUTHENTICATED_ONLY } from '../../common/decorators/authenticated.decorator';
import { ALLOWED_BEFORE_PASSWORD_CHANGE } from '../../common/decorators/before-password-change.decorator';
import { IS_PLATFORM_ADMIN } from '../../common/decorators/platform-admin.decorator';
import { IS_PUBLIC } from '../../common/decorators/public.decorator';
import { REQUIRED_PERMISSION } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { OrganizationMembersService } from '../organizations';
import { UsersRepository } from '../users';
import { PermissionsRepository } from './permissions.repository';
import { PlatformRolesRepository } from './platform-roles.repository';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly members: OrganizationMembersService,
    private readonly permissions: PermissionsRepository,
    private readonly users: UsersRepository,
    private readonly platformRoles: PlatformRolesRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const permission = this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION, targets);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // An admin-given password must be replaced before anything else (the flag comes from the access token).
    if (request.user?.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(ALLOWED_BEFORE_PASSWORD_CHANGE, targets)) {
      throw new ForbiddenException({ message: 'Change your password to continue.', code: 'AUTH_PASSWORD_CHANGE_REQUIRED' });
    }
    const accountOnly = this.reflector.getAllAndOverride<boolean>(IS_AUTHENTICATED_ONLY, targets);
    if (this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_ADMIN, targets)) {
      if (permission || accountOnly) {
        throw new ForbiddenException('An endpoint cannot combine @PlatformAdmin() with @Authenticated() or @RequirePermission().');
      }
      if (!request.user) throw new ForbiddenException('Authentication is required.');
      if (!(await this.users.isActive(request.user.id))) throw new ForbiddenException('The account is not active.');
      // The company header is never read here: platform access must not come from a company role.
      if (!(await this.platformRoles.hasPlatformAccess(request.user.id))) {
        throw new ForbiddenException({ message: 'Platform access is required.', code: 'PLATFORM_ACCESS_REQUIRED' });
      }
      return true;
    }
    if (accountOnly) {
      if (permission) throw new ForbiddenException('An endpoint cannot be both @Authenticated() and @RequirePermission().');
      if (!request.user) throw new ForbiddenException('Authentication is required.');
      if (!(await this.users.isActive(request.user.id))) throw new ForbiddenException('The account is not active.');
      return true;
    }
    if (!permission) throw new ForbiddenException('This endpoint has no configured permission.');
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
