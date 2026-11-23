import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { requestMeta } from '../../common/context/request-meta';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { type AssetsActor, AssetsService } from './assets.service';
import { CheckInDto, CheckOutDto, CreateAssetDto, ListAssetsQueryDto, MaintenanceDto, UpdateAssetDto } from './dto/asset.dto';

const actor = (request: AuthenticatedRequest): AssetsActor => ({
  tenant: request.tenant!,
  userId: request.user!.id,
  meta: requestMeta(request),
});

// The vehicles and equipment of the company named by X-Organization-Id (checked by RolesGuard). Reading needs
// assets.view. Adding and editing need assets.create (there is no assets.edit), checking out and in assets.assign,
// and logging a service assets.log_maintenance.
@Controller('assets')
@RequirePermission('assets.view')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  list(@Query() query: ListAssetsQueryDto, @Req() request: AuthenticatedRequest) {
    return this.assets.list(request.tenant!, query);
  }

  @Get(':assetId')
  get(@Param('assetId') id: string, @Req() request: AuthenticatedRequest) {
    return this.assets.get(request.tenant!, id);
  }

  @Post()
  @RequirePermission('assets.create')
  create(@Body() body: CreateAssetDto, @Req() request: AuthenticatedRequest) {
    return this.assets.create(actor(request), body);
  }

  @Patch(':assetId')
  @RequirePermission('assets.create')
  update(@Param('assetId') id: string, @Body() body: UpdateAssetDto, @Req() request: AuthenticatedRequest) {
    return this.assets.update(actor(request), id, body);
  }

  @Post(':assetId/check-out')
  @HttpCode(200)
  @RequirePermission('assets.assign')
  checkOut(@Param('assetId') id: string, @Body() body: CheckOutDto, @Req() request: AuthenticatedRequest) {
    return this.assets.checkOut(actor(request), id, body);
  }

  @Post(':assetId/check-in')
  @HttpCode(200)
  @RequirePermission('assets.assign')
  checkIn(@Param('assetId') id: string, @Body() body: CheckInDto, @Req() request: AuthenticatedRequest) {
    return this.assets.checkIn(actor(request), id, body);
  }

  @Post(':assetId/maintenance')
  @HttpCode(200)
  @RequirePermission('assets.log_maintenance')
  logMaintenance(@Param('assetId') id: string, @Body() body: MaintenanceDto, @Req() request: AuthenticatedRequest) {
    return this.assets.logMaintenance(actor(request), id, body);
  }
}
