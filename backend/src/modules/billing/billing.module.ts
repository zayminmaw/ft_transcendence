import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { CodController } from './cod.controller';
import { CodRepository } from './cod.repository';
import { CodService } from './cod.service';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';
import { PendingCodService } from './pending-cod.service';

// Money owed between the courier and its merchants. The ledger is the only code that changes a balance; the COD
// handover (and later invoices and payouts) call it inside their own transaction, and every handover is audited.
@Module({
  imports: [AuditModule],
  controllers: [CodController],
  providers: [LedgerRepository, LedgerService, PendingCodService, CodRepository, CodService],
  exports: [LedgerService, PendingCodService],
})
export class BillingModule {}
