import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { requestMeta } from '../../common/context/request-meta';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { type DriversActor, DriversService } from './drivers.service';
import { CreateDriverDto, DutyStatusDto, LinkAccountDto, ListDriversQueryDto, UpdateDriverDto } from './dto/driver.dto';

const actor = (request: AuthenticatedRequest): DriversActor => ({
  tenant: request.tenant!,
  userId: request.user!.id,
  meta: requestMeta(request),
});

// The couriers of the company named by X-Organization-Id (checked by RolesGuard). Reading needs drivers.view; every
// change needs drivers.manage, which replaces it. The fixed paths come before :driverId.
@Controller('drivers')
@RequirePermission('drivers.view')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get()
  list(@Query() query: ListDriversQueryDto, @Req() request: AuthenticatedRequest) {
    return this.drivers.list(request.tenant!, query);
  }

  // For other modules to choose a driver from, e.g. checking an asset out.
  @Get('choices')
  choices(@Req() request: AuthenticatedRequest) {
    return this.drivers.choices(request.tenant!);
  }

  @Get('linkable-accounts')
  @RequirePermission('drivers.manage')
  linkableAccounts(@Req() request: AuthenticatedRequest) {
    return this.drivers.linkableAccounts(request.tenant!);
  }

  @Get(':driverId')
  get(@Param('driverId') id: string, @Req() request: AuthenticatedRequest) {
    return this.drivers.get(request.tenant!, id);
  }

  @Post()
  @RequirePermission('drivers.manage')
  create(@Body() body: CreateDriverDto, @Req() request: AuthenticatedRequest) {
    return this.drivers.create(actor(request), body);
  }

  @Patch(':driverId')
  @RequirePermission('drivers.manage')
  update(@Param('driverId') id: string, @Body() body: UpdateDriverDto, @Req() request: AuthenticatedRequest) {
    return this.drivers.update(actor(request), id, body);
  }

  @Patch(':driverId/duty-status')
  @RequirePermission('drivers.manage')
  setDispatchStatus(@Param('driverId') id: string, @Body() body: DutyStatusDto, @Req() request: AuthenticatedRequest) {
    return this.drivers.setDispatchStatus(actor(request), id, body.dispatchStatus);
  }

  @Put(':driverId/account')
  @RequirePermission('drivers.manage')
  linkAccount(@Param('driverId') id: string, @Body() body: LinkAccountDto, @Req() request: AuthenticatedRequest) {
    return this.drivers.linkAccount(actor(request), id, body.userId);
  }
}
