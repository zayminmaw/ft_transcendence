import type { ParseKeys } from 'i18next';
import { ApiError } from '@services/api-client';
import { CLIENT_ERROR_MESSAGES } from '../constants';

// The API's code for a refusal, e.g. CLIENT_CODE_TAKEN; undefined for anything else.
export function errorCode(error: unknown) {
	return error instanceof ApiError ? error.code : undefined;
}

// A refusal as a translation key: its own message when the code is known, the general one otherwise.
export function clientErrorKey(error: unknown): ParseKeys<'clients'> {
	const code = errorCode(error);
	return code && code in CLIENT_ERROR_MESSAGES
		? CLIENT_ERROR_MESSAGES[code as keyof typeof CLIENT_ERROR_MESSAGES]
		: 'errors.unknown';
}
