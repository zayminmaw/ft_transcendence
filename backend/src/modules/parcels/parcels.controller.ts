import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { requestMeta } from '../../common/context/request-meta';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { AssignParcelDto, CreateParcelDto, ListParcelsQueryDto, StatusMoveDto } from './dto/parcel.dto';
import { type ParcelsActor, ParcelsService } from './parcels.service';

const actor = (request: AuthenticatedRequest): ParcelsActor => ({
  tenant: request.tenant!,
  userId: request.user!.id,
  meta: requestMeta(request),
});

// The parcels of the company named by X-Organization-Id (checked by RolesGuard). Reading needs parcels.view; each
// change needs its own permission, which replaces it: creating a waybill parcels.create, moving it through pickup,
// hub and failure parcels.update_status, sending it out with a driver parcels.dispatch. The fixed paths come before
// :parcelId.
@Controller('parcels')
@RequirePermission('parcels.view')
export class ParcelsController {
  constructor(private readonly parcels: ParcelsService) {}

  @Get()
  list(@Query() query: ListParcelsQueryDto, @Req() request: AuthenticatedRequest) {
    return this.parcels.list(request.tenant!, query);
  }

  // The merchants and zones the new parcel form chooses from.
  @Get('form-options')
  @RequirePermission('parcels.create')
  formOptions(@Req() request: AuthenticatedRequest) {
    return this.parcels.formOptions(request.tenant!);
  }

  // The drivers on duty, with their vehicle and today's run: for whoever sends parcels out, not everyone who reads them
  // (hub sorters and drivers would otherwise see every colleague on duty and their plate).
  @Get('dispatch-drivers')
  @RequirePermission('parcels.dispatch')
  dispatchDrivers(@Req() request: AuthenticatedRequest) {
    return this.parcels.dispatchDrivers(request.tenant!);
  }

  @Get(':parcelId')
  get(@Param('parcelId') id: string, @Req() request: AuthenticatedRequest) {
    return this.parcels.get(request.tenant!, id);
  }

  @Post()
  @RequirePermission('parcels.create')
  create(@Body() body: CreateParcelDto, @Req() request: AuthenticatedRequest) {
    return this.parcels.create(actor(request), body);
  }

  // Actions on an existing parcel: 200, not 201.
  @Post(':parcelId/status')
  @HttpCode(200)
  @RequirePermission('parcels.update_status')
  move(@Param('parcelId') id: string, @Body() body: StatusMoveDto, @Req() request: AuthenticatedRequest) {
    return this.parcels.move(actor(request), id, body);
  }

  @Post(':parcelId/assignment')
  @HttpCode(200)
  @RequirePermission('parcels.dispatch')
  assign(@Param('parcelId') id: string, @Body() body: AssignParcelDto, @Req() request: AuthenticatedRequest) {
    return this.parcels.assign(actor(request), id, body);
  }
}
