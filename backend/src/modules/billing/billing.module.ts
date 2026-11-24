import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { CodController } from './cod.controller';
import { CodRepository } from './cod.repository';
import { CodService } from './cod.service';
import { LedgerHistoryController } from './ledger-history.controller';
import { LedgerHistoryRepository } from './ledger-history.repository';
import { LedgerHistoryService } from './ledger-history.service';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsRepository } from './payouts.repository';
import { PayoutsService } from './payouts.service';
import { PendingCodService } from './pending-cod.service';

// Money owed between the courier and its merchants. The ledger is the only code that changes a balance; the COD
// handover, payouts and (later) invoices call it inside their own audited transaction. Reading a merchant's ledger
// changes nothing.
@Module({
  imports: [AuditModule],
  controllers: [CodController, LedgerHistoryController, PayoutsController],
  providers: [
    LedgerRepository, LedgerService, PendingCodService, CodRepository, CodService, LedgerHistoryRepository, LedgerHistoryService,
    PayoutsRepository, PayoutsService,
  ],
  exports: [LedgerService, PendingCodService],
})
export class BillingModule {}
