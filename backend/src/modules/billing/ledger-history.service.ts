import { Injectable, NotFoundException } from '@nestjs/common';
import { ID_PATTERN } from '../../common/ids';
import type { TenantContext } from '../../common/types/authenticated-request';
import type { LedgerHistoryQueryDto } from './dto/ledger-history-query.dto';
import { LedgerHistoryRepository } from './ledger-history.repository';
import { LEDGER_CLIENT_NOT_FOUND } from './ledger-history.constants';
import type { LedgerPage } from './types/ledger-history';

@Injectable()
export class LedgerHistoryService {
  constructor(private readonly history: LedgerHistoryRepository) {}

  async page(tenant: TenantContext, clientId: string, query: LedgerHistoryQueryDto): Promise<LedgerPage> {
    if (!ID_PATTERN.test(clientId) || !(await this.history.clientExists(tenant.organizationId, clientId))) {
      throw new NotFoundException(LEDGER_CLIENT_NOT_FOUND);
    }
    const { items, total } = await this.history.page(tenant.organizationId, clientId, query.page, query.pageSize);
    return {
      items: items.map((entry) => ({
        id: entry.id,
        entryType: entry.entryType,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        amount: entry.amount,
        balanceAfter: entry.balanceAfter,
        description: entry.description,
        createdAt: entry.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
