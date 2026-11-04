import type { ListClientsQueryDto } from '../dto/client.dto';
import type { Client } from '../entities/client.entity';

export type ClientListQuery = ListClientsQueryDto;

export interface ClientCounts {
  total: number;
  active: number;
  archived: number;
  pinned: number;
}

// What a new client is saved with. Balances start at 0 and the client starts active (the column defaults).
export type NewClient = Omit<Client, 'id' | 'organizationId' | 'currentBalance' | 'pendingCodBalance' | 'isActive' | 'createdAt' | 'updatedAt'>;

// Left out (undefined) keeps the saved value. isActive only through archive / reactivate.
export type ClientChanges = Partial<NewClient & Pick<Client, 'isActive'>>;

type FinancialField = 'currentBalance' | 'pendingCodBalance' | 'rateProfileTier';

// A client as the API answers. The financial fields are there only for clients.view_financials.
export type ClientView = Omit<Client, 'organizationId' | FinancialField> & Partial<Pick<Client, FinancialField>>;
