import { applyDecorators, BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Authenticated } from '../../common/decorators/authenticated.decorator';
import { ID_PATTERN } from '../../common/ids';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { OrganizationMembersService } from '../organizations';
import { PermissionsRepository } from '../rbac';
import { PARCEL_NOT_FOUND } from './constants';
import { ParcelsRepository } from './parcels.repository';

const ACCESS = 'parcelAccess';
type Access = { permission: 'parcels.view' | 'parcels.mark_delivered'; collection: boolean };
export type ParcelRequest = AuthenticatedRequest & { parcelAssignedOnly?: boolean };

// Only these routes implement assigned-resource access. All other permissions keep the global all-scope policy.
export const RequireParcelPermission = (permission: Access['permission'], collection = false) => applyDecorators(
  Authenticated(), SetMetadata(ACCESS, { permission, collection }), UseGuards(ParcelAccessGuard),
);

@Injectable()
export class ParcelAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly members: OrganizationMembersService,
    private readonly permissions: PermissionsRepository,
    private readonly parcels: ParcelsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access = this.reflector.get<Access>(ACCESS, context.getHandler());
    if (!access) throw new ForbiddenException('This endpoint has no configured parcel permission.');
    const request = context.switchToHttp().getRequest<ParcelRequest>();
    const organizationId = request.headers['x-organization-id'];
    if (typeof organizationId !== 'string' || !/^[1-9]\d*$/.test(organizationId)) {
      throw new BadRequestException('X-Organization-Id must be a positive integer.');
    }
    if (!request.user) throw new ForbiddenException('Authentication is required.');
    const tenant = await this.members.requireActiveMembership(request.user.id, organizationId);
    const scope = await this.permissions.findScope(tenant.roleId, access.permission);
    if (scope !== 'all' && scope !== 'assigned_only') throw new ForbiddenException('The requested permission is not available.');
    request.tenant = tenant;
    request.parcelAssignedOnly = scope === 'assigned_only';
    if (request.parcelAssignedOnly && !access.collection) {
      const id = request.params.parcelId;
      if (typeof id !== 'string' || !ID_PATTERN.test(id) || !(await this.parcels.isAssignedTo(organizationId, id, request.user.id))) {
        throw new NotFoundException(PARCEL_NOT_FOUND);
      }
    }
    return true;
  }
}
