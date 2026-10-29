import type { ParseKeys } from 'i18next';
import { ApiError } from '@services/api-client';
import { ASSET_ERROR_MESSAGES, ASSET_FIELD_ERRORS } from '../constants';

// The API's code for a refusal, e.g. ASSET_TAG_TAKEN; undefined for anything else.
export function errorCode(error: unknown) {
	return error instanceof ApiError ? error.code : undefined;
}

// A refusal as a translation key: its own message when the code is known, the general one otherwise.
export function assetErrorKey(error: unknown): ParseKeys<'assets'> {
	const code = errorCode(error);
	return code && code in ASSET_ERROR_MESSAGES
		? ASSET_ERROR_MESSAGES[code as keyof typeof ASSET_ERROR_MESSAGES]
		: 'errors.unknown';
}

// The form field a refusal belongs to, if any; anything else shows above the form.
export function assetErrorField(error: unknown) {
	const code = errorCode(error);
	return code && code in ASSET_FIELD_ERRORS
		? ASSET_FIELD_ERRORS[code as keyof typeof ASSET_FIELD_ERRORS]
		: undefined;
}
