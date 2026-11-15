import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { MerchantLedgerEntry } from './entities/merchant-ledger-entry.entity';

// Everything runs on the caller's manager, so the ledger lines, the balances and whatever else the caller saves (its
// audit row) commit together or not at all.
@Injectable()
export class LedgerRepository {
  // The merchant of this company, locked until the caller's transaction ends, so no other post reads a balance this
  // one is about to change. Another company's merchant is simply not found.
  lockClient(manager: EntityManager, organizationId: string, clientId: string): Promise<Client | null> {
    return manager.getRepository(Client).createQueryBuilder('client')
      .setLock('pessimistic_write')
      .where('client.id = :clientId AND client.organizationId = :organizationId', { clientId, organizationId })
      .getOne();
  }

  // One insert per line, in the order given, so ids rise with the balance chain.
  async insertEntries(manager: EntityManager, rows: Omit<MerchantLedgerEntry, 'id' | 'createdAt'>[]): Promise<MerchantLedgerEntry[]> {
    const repository = manager.getRepository(MerchantLedgerEntry);
    const saved: MerchantLedgerEntry[] = [];
    for (const row of rows) saved.push(await repository.save(repository.create(row)));
    return saved;
  }

  async setBalances(manager: EntityManager, clientId: string, currentBalance: string, pendingCodBalance: string): Promise<void> {
    await manager.getRepository(Client).update({ id: clientId }, { currentBalance, pendingCodBalance });
  }
}
