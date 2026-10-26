import { z } from 'zod';

// The organization details a platform admin can edit. The slug is not here: it is part of every company link.
export const editOrganizationSchema = z.object({
	name: z.string().trim().min(1, 'Enter the organization name.').max(191),
	contactEmail: z
		.string()
		.trim()
		.min(1, 'Enter an email address.')
		.email('Enter a valid email address.'),
	contactPhone: z.string().trim().max(32, 'Use at most 32 characters.'),
	address: z.string().trim().max(1000, 'Use at most 1000 characters.'),
});
