import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { PlatformAdmin } from '../../common/decorators/platform-admin.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { AssignAdministratorDto, RevokeAdministratorDto, SearchMembersQueryDto } from './dto/tenant.dto';
import { actor, tenantId, userId } from './route-params';
import { TenantAdministratorsService } from './tenant-administrators.service';

// Platform administrators only, like the tenant routes.
@PlatformAdmin()
@Controller('platform')
export class TenantAdministratorsController {
  constructor(private readonly administrators: TenantAdministratorsService) {}

  // The roles a revoked administrator can keep working with.
  @Get('member-roles')
  memberRoles() {
    return this.administrators.findMemberRoles();
  }

  // Members who could become administrators.
  @Get('tenants/:tenantId/members')
  members(@Param('tenantId') id: string, @Query() query: SearchMembersQueryDto) {
    return this.administrators.findCandidates(tenantId(id), query.search || undefined);
  }

  @Post('tenants/:tenantId/administrators')
  assign(@Param('tenantId') id: string, @Body() body: AssignAdministratorDto, @Req() request: AuthenticatedRequest) {
    return this.administrators.assign(tenantId(id), body, actor(request));
  }

  @Post('tenants/:tenantId/administrators/:userId/revoke')
  @HttpCode(200)
  revoke(
    @Param('tenantId') id: string, @Param('userId') administratorId: string, @Body() body: RevokeAdministratorDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.administrators.revoke(tenantId(id), userId(administratorId), body, actor(request));
  }
}
