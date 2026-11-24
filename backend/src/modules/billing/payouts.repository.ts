import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { Client } from '../clients/entities/client.entity';
import { MerchantLedgerEntry } from './entities/merchant-ledger-entry.entity';
import { LedgerRepository } from './ledger.repository';

// Payouts of one company. A payout is one ledger line, so the only thing read or changed here besides the ledger is the
// merchant's invoices. Every query is scoped to the company.
@Injectable()
export class PayoutsRepository {
  constructor(private readonly database: DataSource, private readonly ledger: LedgerRepository) {}

  inTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.database.transaction(work);
  }

  // The merchant, locked until the transaction ends. Two payouts for one merchant run one after the other, so the
  // balance checked here is the balance the payout is posted against.
  lockClient(manager: EntityManager, organizationId: string, clientId: string): Promise<Client | null> {
    return this.ledger.lockClient(manager, organizationId, clientId);
  }

  // A payout line already written under this description, i.e. the same wire reference for the same merchant.
  findPayout(manager: EntityManager, organizationId: string, clientId: string, description: string): Promise<MerchantLedgerEntry | null> {
    return manager.getRepository(MerchantLedgerEntry).findOneBy({ organizationId, clientId, referenceType: 'payout_disbursement', description });
  }

  // The merchant's issued invoices, paid by this transfer. Returns how many changed.
  async markInvoicesPaid(manager: EntityManager, organizationId: string, clientId: string): Promise<number> {
    const result = await manager
      .createQueryBuilder()
      .update('invoices')
      .set({ status: 'paid_via_bank_transfer' })
      .where('organization_id = :organizationId', { organizationId })
      .andWhere('client_id = :clientId', { clientId })
      .andWhere('status = :status', { status: 'issued' })
      .execute();
    return result.affected ?? 0;
  }
}
