import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsRepository } from './payouts.repository';
import { PayoutsService } from './payouts.service';

// Money owed between the courier and its merchants. The ledger is the only code that changes a balance; payouts (and
// later the COD handover and invoices) call it inside their own transaction, and every payout is audited.
@Module({
  imports: [AuditModule],
  controllers: [PayoutsController],
  providers: [LedgerRepository, LedgerService, PayoutsRepository, PayoutsService],
  exports: [LedgerService],
})
export class BillingModule {}
