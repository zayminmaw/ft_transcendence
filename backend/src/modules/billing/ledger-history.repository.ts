import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { MerchantLedgerEntry } from './entities/merchant-ledger-entry.entity';

// Reads of one merchant's ledger. Nothing is changed here, and every query is scoped to the company.
@Injectable()
export class LedgerHistoryRepository {
  constructor(private readonly database: DataSource) {}

  // Another company's merchant is simply not found.
  async clientExists(organizationId: string, clientId: string): Promise<boolean> {
    return (await this.database.getRepository(Client).countBy({ organizationId, id: clientId })) > 0;
  }

  // Newest first. Ids rise with the balance chain, so the id breaks ties between lines written in the same second.
  async page(organizationId: string, clientId: string, page: number, pageSize: number): Promise<{ items: MerchantLedgerEntry[]; total: number }> {
    const [items, total] = await this.database.getRepository(MerchantLedgerEntry).createQueryBuilder('entry')
      .where('entry.organizationId = :organizationId AND entry.clientId = :clientId', { organizationId, clientId })
      .orderBy('entry.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total };
  }
}
