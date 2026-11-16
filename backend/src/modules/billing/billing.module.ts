import { Module } from '@nestjs/common';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';

// Money owed between the courier and its merchants. The ledger is the only code that changes a balance; other billing
// features (COD handover, invoices, payouts) call it inside their own transaction.
@Module({
  providers: [LedgerRepository, LedgerService],
  exports: [LedgerService],
})
export class BillingModule {}
