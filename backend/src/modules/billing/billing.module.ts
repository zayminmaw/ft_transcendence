import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { LedgerHistoryController } from './ledger-history.controller';
import { LedgerHistoryRepository } from './ledger-history.repository';
import { LedgerHistoryService } from './ledger-history.service';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsRepository } from './payouts.repository';
import { PayoutsService } from './payouts.service';
import { PendingCodService } from './pending-cod.service';

// Money owed between the courier and its merchants. The ledger is the only code that changes a balance; other billing
// features (COD handover, invoices, payouts) call it inside their own audited transaction. Reading a merchant's ledger
// changes nothing.
@Module({
  imports: [AuditModule],
  controllers: [LedgerHistoryController, PayoutsController],
  providers: [LedgerRepository, LedgerService, PendingCodService, LedgerHistoryRepository, LedgerHistoryService, PayoutsRepository, PayoutsService],
  exports: [LedgerService, PendingCodService],
})
export class BillingModule {}
