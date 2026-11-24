import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { RequestMeta } from '../../common/context/request-meta';
import type { TenantContext } from '../../common/types/authenticated-request';
import { AuditService } from '../audit';
import type { CreatePayoutDto } from './dto/create-payout.dto';
import type { MerchantLedgerEntry } from './entities/merchant-ledger-entry.entity';
import { LedgerService } from './ledger.service';
import { toCents } from './money';
import { PAYOUT_EXCEEDS_BALANCE, PAYOUT_MERCHANT_NOT_FOUND, PAYOUT_REFERENCE_REUSED } from './payout.constants';
import { PayoutsRepository } from './payouts.repository';
import type { PayoutView } from './types/payout';

// Who is asking: the verified company, and the account, for the ledger and the audit row.
export interface PayoutActor {
  tenant: TenantContext;
  userId: string;
  meta: RequestMeta;
}

const describe = (wireReference: string): string => `Payout ${wireReference}`;

const view = (entry: MerchantLedgerEntry, wireReference: string, repeated: boolean): PayoutView => ({
  id: entry.id, clientId: entry.clientId, wireReference, amount: entry.amount, balanceAfter: entry.balanceAfter,
  createdAt: entry.createdAt.toISOString(), repeated,
});

// Finance wires a merchant the money the courier owes it. One transaction checks the amount against the merchant's
// balance, writes one debit line, and audits it. When the payout clears the whole balance, the merchant's issued
// invoices are marked paid too. A payout bigger than the balance is refused and nothing is stored.
@Injectable()
export class PayoutsService {
  constructor(
    private readonly payouts: PayoutsRepository,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  create(actor: PayoutActor, body: CreatePayoutDto): Promise<PayoutView> {
    const organizationId = actor.tenant.organizationId;
    const description = describe(body.wireReference);
    return this.payouts.inTransaction(async (manager) => {
      const client = await this.payouts.lockClient(manager, organizationId, body.clientId);
      if (!client) throw new NotFoundException(PAYOUT_MERCHANT_NOT_FOUND);

      // Read after the lock: a request for the same reference that ran first has committed by now.
      const existing = await this.payouts.findPayout(manager, organizationId, body.clientId, description);
      if (existing) {
        if (toCents(existing.amount) !== toCents(body.amount)) throw new ConflictException(PAYOUT_REFERENCE_REUSED);
        return view(existing, body.wireReference, true);
      }

      const amount = toCents(body.amount);
      const balance = toCents(client.currentBalance);
      if (amount > balance) throw new ConflictException({ ...PAYOUT_EXCEEDS_BALANCE, balance: client.currentBalance });

      const result = await this.ledger.post(manager, {
        organizationId, clientId: body.clientId, createdByUserId: actor.userId,
        lines: [{ direction: 'debit', amount: body.amount, referenceType: 'payout_disbursement', referenceId: null, description }],
      });
      if (result.status !== 'posted') throw new Error('The merchant of a payout was not found, so the payout was rolled back.');
      const entry = result.entries[0];

      const invoicesPaid = amount === balance ? await this.payouts.markInvoicesPaid(manager, organizationId, body.clientId) : 0;
      await this.audit.record(manager, {
        module: 'billing', action: 'create', resourceType: 'payout', recordId: entry.id, resourceLabel: body.wireReference,
        organizationId, actorId: actor.userId,
        after: { amount: entry.amount, balanceAfter: entry.balanceAfter },
        params: { invoicesPaid }, meta: actor.meta,
      });
      return view(entry, body.wireReference, false);
    });
  }
}
