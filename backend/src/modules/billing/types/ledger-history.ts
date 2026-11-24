import type { LedgerReferenceType } from '../entities/merchant-ledger-entry.entity';

// One line of a merchant's ledger as the screens see it. Amounts are positive; the direction says which way the
// balance moved, and balanceAfter is the balance once this line was posted.
export type LedgerEntryView = {
  id: string;
  entryType: 'credit' | 'debit';
  referenceType: LedgerReferenceType;
  referenceId: string | null;
  amount: string;
  balanceAfter: string;
  description: string;
  createdAt: string;
};

export type LedgerPage = { items: LedgerEntryView[]; total: number; page: number; pageSize: number };
