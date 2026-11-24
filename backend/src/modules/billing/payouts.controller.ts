import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { requestMeta } from '../../common/context/request-meta';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { PAYOUT_PERMISSION } from './payout.constants';
import { PayoutsService } from './payouts.service';

// Finance paying a merchant out, in the company named by X-Organization-Id (checked by RolesGuard).
@Controller('billing/payouts')
@RequirePermission(PAYOUT_PERMISSION)
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  // 200 whether this is the first request or a repeat of the same wire reference; `repeated` tells which.
  @Post()
  @HttpCode(200)
  create(@Body() body: CreatePayoutDto, @Req() request: AuthenticatedRequest) {
    return this.payouts.create({ tenant: request.tenant!, userId: request.user!.id, meta: requestMeta(request) }, body);
  }
}
