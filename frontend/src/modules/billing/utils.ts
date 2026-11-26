import type { ParseKeys } from 'i18next';
import { ApiError } from '@services/api-client';

// Money as the API wants it: above zero, one to ten whole digits and exactly two decimals.
export const PAYOUT_AMOUNT_PATTERN = /^(?!0+\.00$)\d{1,10}\.\d{2}$/;
export const WIRE_REFERENCE_PATTERN = /^[A-Za-z0-9._-]{4,40}$/;

const PAYOUT_ERRORS = {
	PAYOUT_MERCHANT_NOT_FOUND: 'payout.errors.notFound',
	PAYOUT_EXCEEDS_BALANCE: 'payout.errors.exceedsBalance',
	PAYOUT_REFERENCE_REUSED: 'payout.errors.referenceReused',
} as const satisfies Record<string, ParseKeys<'billing'>>;

// A refusal as a translation key: its own message when the code is known, the general one otherwise.
export function payoutErrorKey(error: unknown): ParseKeys<'billing'> {
	const code = error instanceof ApiError ? error.code : undefined;
	return code && code in PAYOUT_ERRORS
		? PAYOUT_ERRORS[code as keyof typeof PAYOUT_ERRORS]
		: 'payout.errors.unknown';
}

// What the API accepts: one to ten whole digits and exactly two decimals; a reference of 4 to 40 safe characters.
export const CASH_AMOUNT_PATTERN = /^\d{1,10}\.\d{2}$/;
export const HANDOVER_REFERENCE_PATTERN = /^[A-Za-z0-9._-]{4,40}$/;

const HANDOVER_ERRORS = {
	COD_PENDING_TOO_LOW: 'cashHandover.errors.pendingTooLow',
	COD_DRIVER_NOT_FOUND: 'cashHandover.errors.driverNotFound',
	COD_PARCELS_NOT_ELIGIBLE: 'cashHandover.errors.parcelsNotEligible',
	COD_REFERENCE_REUSED: 'cashHandover.errors.referenceReused',
} as const satisfies Record<string, ParseKeys<'billing'>>;

// A refusal as a translation key, or null when the server's own message should be shown: the wrong-count refusal
// carries both amounts in its message, which the page can't rebuild.
export function handoverErrorKey(error: unknown): ParseKeys<'billing'> | null {
	const code = error instanceof ApiError ? error.code : undefined;
	if (code === 'COD_DISCREPANCY') return null;
	return code && code in HANDOVER_ERRORS
		? HANDOVER_ERRORS[code as keyof typeof HANDOVER_ERRORS]
		: 'cashHandover.errors.unknown';
}
