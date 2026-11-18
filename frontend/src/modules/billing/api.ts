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
