import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { PlatformAdmin } from '../../common/decorators/platform-admin.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { CreateTenantDto, ListTenantsQueryDto, ReactivateTenantDto, SuspendTenantDto, UpdateTenantDto } from './dto/tenant.dto';
import { actor, tenantId } from './route-params';
import { TenantsService } from './tenants.service';

// Platform administrators only. Tenant roles and X-Organization-Id never open these routes.
@PlatformAdmin()
@Controller('platform/tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  list(@Query() query: ListTenantsQueryDto) {
    return this.tenants.list(query);
  }

  @Post()
  create(@Body() body: CreateTenantDto, @Req() request: AuthenticatedRequest) {
    return this.tenants.create(body, actor(request));
  }

  @Get(':tenantId')
  get(@Param('tenantId') id: string) {
    return this.tenants.get(tenantId(id));
  }

  @Patch(':tenantId')
  update(@Param('tenantId') id: string, @Body() body: UpdateTenantDto, @Req() request: AuthenticatedRequest) {
    return this.tenants.update(tenantId(id), body, actor(request));
  }

  @Post(':tenantId/suspend')
  @HttpCode(200)
  suspend(@Param('tenantId') id: string, @Body() body: SuspendTenantDto, @Req() request: AuthenticatedRequest) {
    return this.tenants.setActive(tenantId(id), false, body.reason, actor(request));
  }

  @Post(':tenantId/reactivate')
  @HttpCode(200)
  reactivate(@Param('tenantId') id: string, @Body() body: ReactivateTenantDto, @Req() request: AuthenticatedRequest) {
    return this.tenants.setActive(tenantId(id), true, body.reason ?? null, actor(request));
  }
}
