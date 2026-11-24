import type { ParseKeys } from 'i18next';
import { errorKey, fromErrorCode } from '@services/api-client';

// The API's codes for parcels, as translation keys. Anything else gets the general message.
const MESSAGES = {
	PARCEL_NOT_FOUND: 'errors.notFound',
	PARCEL_CLIENT_UNAVAILABLE: 'errors.clientUnavailable',
	PARCEL_DRIVER_UNAVAILABLE: 'errors.driverUnavailable',
	PARCEL_WRONG_STATUS: 'errors.wrongStatus',
	PARCEL_COD_MISMATCH: 'errors.codMismatch',
	PARCEL_NOT_YOUR_PARCEL: 'errors.notYours',
	PARCEL_PROOF_MISSING: 'errors.proofMissing',
	PARCEL_PROOF_TYPE: 'errors.proofType',
	PARCEL_PROOF_KIND: 'errors.proofKind',
} as const satisfies Record<string, ParseKeys<'parcels'>>;

export const parcelErrorKey = (error: unknown) => errorKey(MESSAGES, error);

// The create form validates only on the server, whose field messages ("recipientPhone must be a phone number")
// have no code. shortcut: those stay English; validate the form in the browser, as clients do, to translate them.
export const parcelFormError = (t: (key: ParseKeys<'parcels'>) => string, error: Error) => {
	const key = fromErrorCode(MESSAGES, error);
	return key ? t(key) : error.message;
};
