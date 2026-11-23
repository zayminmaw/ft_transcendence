import { z } from 'zod';
import { EMAIL_MAX_LENGTH, EMAIL_PATTERN } from '@utils/form-rules';

// A company's contact address: the API's general email check, not the stricter one for login accounts.
export const contactEmailSchema = z
	.string()
	.trim()
	.min(1, 'Enter an email address.')
	.max(EMAIL_MAX_LENGTH, 'Use at most 191 characters.')
	.regex(EMAIL_PATTERN, 'Enter a valid email address.');

// The organization details a platform admin can edit. The slug is not here: it is part of every company link.
export const editOrganizationSchema = z.object({
	name: z.string().trim().min(1, 'Enter the organization name.').max(191),
	contactEmail: contactEmailSchema,
	contactPhone: z.string().trim().max(32, 'Use at most 32 characters.'),
	address: z.string().trim().max(1000, 'Use at most 1000 characters.'),
});
