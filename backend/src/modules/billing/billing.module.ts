import { Module } from '@nestjs/common';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';
import { PendingCodService } from './pending-cod.service';

// Money owed between the courier and its merchants. The ledger is the only code that changes a balance; other billing
// features (COD handover, invoices, payouts) call it inside their own transaction.
@Module({
  providers: [LedgerRepository, LedgerService, PendingCodService],
  exports: [LedgerService, PendingCodService],
})
export class BillingModule {}
