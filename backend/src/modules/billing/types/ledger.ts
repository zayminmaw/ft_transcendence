import type { LedgerReferenceType, MerchantLedgerEntry } from '../entities/merchant-ledger-entry.entity';

// A credit raises what the courier owes the merchant, a debit lowers it. Amounts are positive; the direction is the sign.
export type LedgerLine = {
  direction: 'credit' | 'debit';
  amount: string;
  referenceType: LedgerReferenceType;
  referenceId: string | null;
  description: string;
};

export type LedgerPost = {
  organizationId: string;
  clientId: string;
  // Posted in this order, each one's balance_after following the one before.
  lines: LedgerLine[];
  // Moves the in-transit COD balance, signed (e.g. '-100.00' when a parcel's cash is verified). Optional.
  pendingChange?: string;
  createdByUserId: string | null;
};

export type LedgerResult =
  | { status: 'posted'; entries: MerchantLedgerEntry[]; currentBalance: string; pendingCodBalance: string }
  | { status: 'client_not_found' };
