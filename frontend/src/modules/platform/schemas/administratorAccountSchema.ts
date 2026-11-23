import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import { ACCOUNT_EMAIL_PATTERN, EMAIL_MAX_LENGTH } from '@utils/form-rules';

// Messages are translation keys, translated when shown.
const key = (value: ParseKeys<'platform'>) => value;

// A login account's email: the API's stricter account check (users/accounts).
const emailSchema = z
	.string()
	.trim()
	.min(1, key('errors.emailRequired'))
	.max(EMAIL_MAX_LENGTH, key('errors.emailMax'))
	.regex(ACCOUNT_EMAIL_PATTERN, key('errors.accountEmail'));

// A new tenant administrator's account, on the create tenant page and the assign administrator dialog.
export const administratorAccountSchema = z.object({
	username: z
		.string()
		.trim()
		.regex(/^[A-Za-z0-9._-]{3,64}$/, key('errors.username')),
	email: emailSchema,
	password: z
		.string()
		.min(8, key('errors.passwordLength'))
		.max(128, key('errors.passwordLength'))
		.regex(/[a-z]/, key('errors.passwordLower'))
		.regex(/[A-Z]/, key('errors.passwordUpper'))
		.regex(/[0-9]/, key('errors.passwordNumber'))
		.regex(/[^A-Za-z0-9]/, key('errors.passwordSymbol')),
});
