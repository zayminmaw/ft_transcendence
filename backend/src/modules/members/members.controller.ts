import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { requestMeta } from '../auth';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MembersService } from './members.service';

// Every route needs admin.manage_users in the company named by X-Organization-Id (checked by RolesGuard).
@Controller('members')
@RequirePermission('admin.manage_users')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.members.list(request.tenant!);
  }

  @Get('assignable-roles')
  assignableRoles() {
    return this.members.assignableRoles();
  }

  // What each role allows, for the Roles & permissions tab. Seeing the role definitions is admin.manage_roles.
  @Get('roles')
  @RequirePermission('admin.manage_roles')
  roles(@Req() request: AuthenticatedRequest) {
    return this.members.roleOverview(request.tenant!);
  }

  @Post()
  create(@Body() body: CreateMemberDto, @Req() request: AuthenticatedRequest) {
    return this.members.create(request.tenant!, request.user!.id, body, requestMeta(request));
  }

  @Patch(':userId')
  update(@Param('userId') userId: string, @Body() body: UpdateMemberDto, @Req() request: AuthenticatedRequest) {
    if ((body.isActive === undefined) === (body.roleCode === undefined)) {
      throw new BadRequestException('Send either isActive or roleCode.');
    }
    const meta = requestMeta(request);
    return body.roleCode !== undefined
      ? this.members.changeRole(request.tenant!, request.user!.id, userId, body.roleCode, meta)
      : this.members.setActive(request.tenant!, request.user!.id, userId, body.isActive!, meta);
  }

  @Post(':userId/password-reset')
  @HttpCode(200)
  resetPassword(@Param('userId') userId: string, @Req() request: AuthenticatedRequest) {
    return this.members.resetPassword(request.tenant!, request.user!.id, userId, requestMeta(request));
  }
}
