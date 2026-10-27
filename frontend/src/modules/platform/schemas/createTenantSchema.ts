import { z } from 'zod';
import { administratorAccountSchema, emailSchema } from './administratorAccountSchema';

// The same rules as the API, so most mistakes are caught before sending.
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
		contactEmail: emailSchema,
		contactPhone: z.string().trim().max(32, 'Use at most 32 characters.'),
		address: z.string().trim().max(1000, 'Use at most 1000 characters.'),
	}),
	administrator: administratorAccountSchema,
});
