// /api/billing/clients/:clientId/ledger: one merchant's running balance, line by line (clients.view_financials).
export type LedgerReferenceType =
	| 'cod_credit'
	| 'delivery_fee_debit'
	| 'payout_disbursement'
	| 'manual_adjustment'
	| 'invoice_offset';

// Amounts are positive; entryType says which way the balance moved, and balanceAfter is the balance once this line was
// posted.
export type LedgerEntry = {
	id: string;
	entryType: 'credit' | 'debit';
	referenceType: LedgerReferenceType;
	referenceId: string | null;
	amount: string;
	balanceAfter: string;
	description: string;
	createdAt: string;
};

export type LedgerPage = {
	items: LedgerEntry[];
	total: number;
	page: number;
	pageSize: number;
};
