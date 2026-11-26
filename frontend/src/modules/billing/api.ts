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

// /api/billing/payouts: finance paying a merchant out of its balance (billing.adjust_balance). Refusals carry a code,
// e.g. PAYOUT_EXCEEDS_BALANCE or PAYOUT_REFERENCE_REUSED.
export type PayoutValues = {
	clientId: string;
	// Above zero, exactly two decimals.
	amount: string;
	// The bank's reference for the wire. Sending the same one again never pays twice.
	wireReference: string;
};

export type Payout = {
	id: string;
	clientId: string;
	wireReference: string;
	amount: string;
	balanceAfter: string;
	createdAt: string;
	// True when this wire reference was sent before: nothing new was recorded.
	repeated: boolean;
};

// /api/billing: what the cashier handover answers with. Money stays a string like the DECIMAL columns.

// One delivered parcel whose cash has not been handed over yet.
export type WaitingParcel = {
	id: string;
	trackingNumber: string;
	clientId: string;
	codAmount: string;
	deliveredAt: string | null;
};

// GET /api/billing/reconcile-cod/driver/:driverId/unreconciled-parcels
export type WaitingCash = {
	driverId: string;
	expectedTotal: string;
	parcels: WaitingParcel[];
};

// GET /api/billing/reconcile-cod/drivers, including former drivers with unsettled parcels.
export type CashDriver = { id: string; name: string; employeeCode: string };

// POST /api/billing/reconcile-cod. The cash must equal the parcels' COD exactly.
export type HandoverValues = {
	driverId: string;
	settlementReference: string;
	totalCashDropped: string;
	parcelIds: string[];
};

export type Handover = {
	id: string;
	reference: string;
	driverId: string;
	status: 'pending' | 'verified' | 'discrepancy_flagged';
	totalCodExpected: string;
	totalCashDropped: string;
	// True when the same reference was sent before: nothing new was recorded.
	repeated: boolean;
};

// /api/billing/invoices: a merchant's delivery fees for a period, as a statement (billing.create_invoice). Only the
// delivery fee is billed, so the COD column is always 0.00.
export type InvoiceStatus =
	'draft' | 'issued' | 'paid_via_balance_offset' | 'paid_via_bank_transfer' | 'overdue';

// One row of the list, without the parcel lines.
export type InvoiceSummary = {
	id: string;
	invoiceNumber: string;
	clientId: string;
	// 'YYYY-MM-DD' days, the last one included.
	periodStart: string;
	periodEnd: string;
	status: InvoiceStatus;
	totalDeliveries: number;
	totalDeliveryFees: string;
	totalCodCollected: string;
	netAmountDue: string;
	createdAt: string;
};

export type InvoicePage = {
	items: InvoiceSummary[];
	total: number;
	page: number;
	pageSize: number;
};

export type InvoiceLine = {
	parcelId: string;
	trackingNumber: string;
	deliveryFee: string;
};

// One invoice with its parcel lines.
export type Invoice = {
	id: string;
	invoiceNumber: string;
	clientId: string;
	periodStart: string;
	periodEnd: string;
	status: InvoiceStatus;
	issueDate: string;
	dueDate: string;
	totalDeliveries: number;
	totalDeliveryFees: string;
	netAmountDue: string;
	notes: string | null;
	items: InvoiceLine[];
};

// What finance sends to bill a merchant. Refusals carry a code, e.g. INVOICE_NOTHING_TO_BILL.
export type InvoiceValues = {
	clientId: string;
	periodStart: string;
	periodEnd: string;
	notes?: string;
};
