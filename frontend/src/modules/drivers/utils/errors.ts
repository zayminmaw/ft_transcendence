import type { ParseKeys } from 'i18next';
import { ApiError } from '@services/api-client';
import { DRIVER_ERROR_MESSAGES, DRIVER_FIELD_ERRORS } from '../constants';

// The API's code for a refusal, e.g. LICENSE_NUMBER_TAKEN; undefined for anything else.
export function errorCode(error: unknown) {
	return error instanceof ApiError ? error.code : undefined;
}

// A refusal as a translation key: its own message when the code is known, the general one otherwise.
export function driverErrorKey(error: unknown): ParseKeys<'drivers'> {
	const code = errorCode(error);
	return code && code in DRIVER_ERROR_MESSAGES
		? DRIVER_ERROR_MESSAGES[code as keyof typeof DRIVER_ERROR_MESSAGES]
		: 'errors.unknown';
}

// The form field a refusal belongs to, if any; anything else shows above the form.
export function driverErrorField(error: unknown) {
	const code = errorCode(error);
	return code && code in DRIVER_FIELD_ERRORS
		? DRIVER_FIELD_ERRORS[code as keyof typeof DRIVER_FIELD_ERRORS]
		: undefined;
}
