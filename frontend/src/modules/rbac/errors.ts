import type { ParseKeys } from 'i18next';
import { ApiError } from '@services/api-client';

// The API's codes for People & access, as translation keys. Anything else gets the general message.
const MESSAGES = {
	INVALID_USERNAME: 'errors.invalidUsername',
	INVALID_EMAIL: 'errors.invalidEmail',
	PASSWORD_RULE: 'errors.passwordRule',
	ROLE_NOT_ASSIGNABLE: 'errors.roleNotAssignable',
	MEMBER_TAKEN: 'errors.taken',
	MEMBER_NOT_ALLOWED: 'errors.notAllowed',
	MEMBER_NOT_FOUND: 'errors.notFound',
	MEMBER_SELF: 'errors.self',
} as const satisfies Record<string, ParseKeys<'rbac'>>;

export function errorCode(error: unknown) {
	return error instanceof ApiError ? error.code : undefined;
}

export function memberErrorKey(error: unknown): ParseKeys<'rbac'> {
	const code = errorCode(error);
	return code && code in MESSAGES ? MESSAGES[code as keyof typeof MESSAGES] : 'errors.unknown';
}
