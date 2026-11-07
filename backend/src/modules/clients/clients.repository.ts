import { Injectable } from '@nestjs/common';
import { Brackets, DataSource, type EntityManager } from 'typeorm';
import { isDuplicateKey } from '../../common/database-errors';
import { containsPattern } from '../../common/like-pattern';
import { Client } from './entities/client.entity';
import type { ClientChanges, ClientCounts, ClientListQuery, NewClient } from './types/client';

// Writes its audit row with the change's own manager, so both are saved or neither.
export type AuditStep = (manager: EntityManager, before: Client | null, after: Client) => Promise<void>;

type CreateResult = { status: 'created'; client: Client } | { status: 'code_taken' };
type UpdateResult = { status: 'updated' | 'unchanged'; client: Client } | { status: 'not_found' } | { status: 'code_taken' };

const SORT_COLUMNS = { businessName: 'client.businessName', clientCode: 'client.clientCode', createdAt: 'client.createdAt' } as const;
const SEARCHED = ['client.businessName', 'client.clientCode', 'client.contactPersonName', 'client.mobile1'];

// The merchants of one company. Every query and change is scoped to the company; an id from another company is
// simply not found. A taken client code is refused by the unique key (organization_id, client_code): the transaction
// rolls back, audit row included.
@Injectable()
export class ClientsRepository {
  constructor(private readonly database: DataSource) {}

  // Every value is a parameter and the sort comes from SORT_COLUMNS; the id breaks ties, so pages never overlap.
  async list(organizationId: string, query: ClientListQuery): Promise<{ items: Client[]; total: number }> {
    const builder = this.database.getRepository(Client).createQueryBuilder('client')
      .where('client.organizationId = :organizationId', { organizationId });
    if (query.search) {
      const pattern = containsPattern(query.search);
      builder.andWhere(new Brackets((where) => {
        for (const column of SEARCHED) where.orWhere(`${column} LIKE :pattern`, { pattern });
      }));
    }
    if (query.status !== 'all') builder.andWhere('client.isActive = :isActive', { isActive: query.status === 'active' });
    const direction = query.direction === 'desc' ? 'DESC' : 'ASC';
    const [items, total] = await builder
      .orderBy(SORT_COLUMNS[query.sort], direction)
      .addOrderBy('client.id', direction)
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return { items, total };
  }

  // Over the whole company, whatever the search and filter. Pinned: active clients with pickup coordinates.
  async counts(organizationId: string): Promise<ClientCounts> {
    const row = await this.database.getRepository(Client).createQueryBuilder('client')
      .select('COUNT(*)', 'total')
      .addSelect('COALESCE(SUM(client.isActive = TRUE), 0)', 'active')
      .addSelect(
        'COALESCE(SUM(client.isActive = TRUE AND client.pickupLatitude IS NOT NULL AND client.pickupLongitude IS NOT NULL), 0)',
        'pinned',
      )
      .where('client.organizationId = :organizationId', { organizationId })
      .getRawOne<{ total: string; active: string; pinned: string }>();
    const total = Number(row?.total ?? 0);
    const active = Number(row?.active ?? 0);
    return { total, active, archived: total - active, pinned: Number(row?.pinned ?? 0) };
  }

  find(organizationId: string, id: string): Promise<Client | null> {
    return this.database.getRepository(Client).findOneBy({ organizationId, id });
  }

  async create(organizationId: string, values: NewClient, audit: AuditStep): Promise<CreateResult> {
    try {
      return await this.database.transaction(async (manager) => {
        const { identifiers } = await manager.insert(Client, { ...values, organizationId });
        const client = await manager.findOneByOrFail(Client, { organizationId, id: String(identifiers[0]?.id) });
        await audit(manager, null, client);
        return { status: 'created', client } as const;
      });
    } catch (error) {
      if (isDuplicateKey(error)) return { status: 'code_taken' };
      throw error;
    }
  }

  // Locks the row, so two edits at once run one after the other and each audits what it really changed. Changes
  // equal to the saved values write nothing.
  async update(organizationId: string, id: string, changes: ClientChanges, audit: AuditStep): Promise<UpdateResult> {
    try {
      return await this.database.transaction(async (manager) => {
        const before = await manager.findOne(Client, { where: { organizationId, id }, lock: { mode: 'pessimistic_write' } });
        if (!before) return { status: 'not_found' } as const;
        const changed = Object.fromEntries(
          Object.entries(changes).filter(([field, value]) => value !== undefined && before[field as keyof Client] !== value),
        ) as ClientChanges;
        if (Object.keys(changed).length === 0) return { status: 'unchanged', client: before } as const;
        await manager.update(Client, { organizationId, id }, changed);
        const after = await manager.findOneByOrFail(Client, { organizationId, id });
        await audit(manager, before, after);
        return { status: 'updated', client: after } as const;
      });
    } catch (error) {
      if (isDuplicateKey(error)) return { status: 'code_taken' };
      throw error;
    }
  }

  // Archived or active again: an update of isActive alone, so the state it already has changes nothing.
  async setActive(organizationId: string, id: string, isActive: boolean, audit: AuditStep) {
    return this.update(organizationId, id, { isActive }, audit);
  }
}
