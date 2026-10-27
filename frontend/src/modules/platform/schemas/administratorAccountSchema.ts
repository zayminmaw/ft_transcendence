import { z } from 'zod';

// The same rules as the API, so most mistakes are caught before sending.
export const emailSchema = z
	.string()
	.trim()
	.min(1, 'Enter an email address.')
	.email('Enter a valid email address.');

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
