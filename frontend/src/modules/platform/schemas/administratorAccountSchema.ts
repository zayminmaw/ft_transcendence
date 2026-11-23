import { z } from 'zod';
import { ACCOUNT_EMAIL_PATTERN, EMAIL_MAX_LENGTH } from '@utils/form-rules';

// A login account's email: the API's stricter account check (users/accounts).
const emailSchema = z
	.string()
	.trim()
	.min(1, 'Enter an email address.')
	.max(EMAIL_MAX_LENGTH, 'Use at most 191 characters.')
	.regex(
		ACCOUNT_EMAIL_PATTERN,
		'Enter a valid email address without spaces or accented letters.',
	);

// A new tenant administrator's account, on the create tenant page and the assign administrator dialog.
export const administratorAccountSchema = z.object({
	username: z
		.string()
		.trim()
		.regex(/^[A-Za-z0-9._-]{3,64}$/, '3-64 letters, numbers, dots, dashes or underscores.'),
	email: emailSchema,
	password: z
		.string()
		.min(8, 'Use 8-128 characters.')
		.max(128, 'Use 8-128 characters.')
		.regex(/[a-z]/, 'Add a lower-case letter.')
		.regex(/[A-Z]/, 'Add an upper-case letter.')
		.regex(/[0-9]/, 'Add a number.')
		.regex(/[^A-Za-z0-9]/, 'Add a symbol.'),
});
