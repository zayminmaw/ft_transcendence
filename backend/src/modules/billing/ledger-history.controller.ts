import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { LedgerHistoryQueryDto } from './dto/ledger-history-query.dto';
import { LEDGER_HISTORY_PERMISSION } from './ledger-history.constants';
import { LedgerHistoryService } from './ledger-history.service';

// A merchant's ledger, in the company named by X-Organization-Id (checked by RolesGuard).
@Controller('billing/clients/:clientId/ledger')
@RequirePermission(LEDGER_HISTORY_PERMISSION)
export class LedgerHistoryController {
  constructor(private readonly history: LedgerHistoryService) {}

  @Get()
  list(@Param('clientId') clientId: string, @Query() query: LedgerHistoryQueryDto, @Req() request: AuthenticatedRequest) {
    return this.history.page(request.tenant!, clientId, query);
  }
}
