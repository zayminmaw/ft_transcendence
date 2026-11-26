import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { requestMeta } from '../../common/context/request-meta';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { type CodActor, CodService } from './cod.service';
import { RECONCILE_PERMISSION } from './constants';
import { ReconcileCodDto } from './dto/reconcile-cod.dto';

const actor = (request: AuthenticatedRequest): CodActor => ({
  tenant: request.tenant!,
  userId: request.user!.id,
  meta: requestMeta(request),
});

// The cashier's COD handover, in the company named by X-Organization-Id (checked by RolesGuard). All routes need the
// approval permission: choosing a driver and looking at what they owe are part of approving it.
@Controller('billing/reconcile-cod')
@RequirePermission(RECONCILE_PERMISSION)
export class CodController {
  constructor(private readonly cod: CodService) {}

  @Get('drivers')
  drivers(@Req() request: AuthenticatedRequest) {
    return this.cod.drivers(request.tenant!);
  }

  @Get('driver/:driverId/unreconciled-parcels')
  waiting(@Param('driverId') driverId: string, @Req() request: AuthenticatedRequest) {
    return this.cod.waiting(request.tenant!, driverId);
  }

  // 200 whether this is the first request or a repeat of the same reference; `repeated` tells which.
  @Post()
  @HttpCode(200)
  reconcile(@Body() body: ReconcileCodDto, @Req() request: AuthenticatedRequest) {
    return this.cod.reconcile(actor(request), body);
  }
}
