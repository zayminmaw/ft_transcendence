import { z } from 'zod';

// The same rules as the API, so most mistakes are caught before sending.
const email = z
	.string()
	.trim()
	.min(1, 'Enter an email address.')
	.email('Enter a valid email address.');
export const createTenantSchema = z.object({
	organization: z.object({
		name: z.string().trim().min(1, 'Enter the organization name.').max(191),
		slug: z
			.string()
			.trim()
			.min(1, 'Enter a slug.')
			.max(64, 'Use at most 64 characters.')
			.regex(
				/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
				'Use lower-case letters and numbers joined by single dashes.',
			),
		contactEmail: email,
		contactPhone: z.string().trim().max(32, 'Use at most 32 characters.'),
		address: z.string().trim().max(1000, 'Use at most 1000 characters.'),
	}),
	administrator: z.object({
		username: z
			.string()
			.trim()
			.regex(/^[A-Za-z0-9._-]{3,64}$/, '3-64 letters, numbers, dots, dashes or underscores.'),
		email,
		password: z
			.string()
			.min(8, 'Use 8-128 characters.')
			.max(128, 'Use 8-128 characters.')
			.regex(/[a-z]/, 'Add a lower-case letter.')
			.regex(/[A-Z]/, 'Add an upper-case letter.')
			.regex(/[0-9]/, 'Add a number.')
			.regex(/[^A-Za-z0-9]/, 'Add a symbol.'),
	}),
});
