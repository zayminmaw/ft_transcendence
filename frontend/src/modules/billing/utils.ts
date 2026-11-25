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

export const INVOICE_NOTES_MAX = 1000;

const INVOICE_ERRORS = {
	INVOICE_MERCHANT_NOT_FOUND: 'invoices.errors.notFound',
	INVOICE_BAD_PERIOD: 'invoices.errors.badPeriod',
	INVOICE_NOTHING_TO_BILL: 'invoices.errors.nothingToBill',
} as const satisfies Record<string, ParseKeys<'billing'>>;

// A refusal as a translation key: its own message when the code is known, the general one otherwise.
export function invoiceErrorKey(error: unknown): ParseKeys<'billing'> {
	const code = error instanceof ApiError ? error.code : undefined;
	return code && code in INVOICE_ERRORS
		? INVOICE_ERRORS[code as keyof typeof INVOICE_ERRORS]
		: 'invoices.errors.unknown';
}
