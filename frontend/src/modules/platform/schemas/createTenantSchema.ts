import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import { administratorAccountSchema } from './administratorAccountSchema';
import { contactEmailSchema } from './editOrganizationSchema';

const key = (value: ParseKeys<'platform'>) => value;

// The same rules as the API, so most mistakes are caught before sending.
export const createTenantSchema = z.object({
	organization: z.object({
		name: z.string().trim().min(1, key('errors.nameRequired')).max(191),
		slug: z
			.string()
			.trim()
			.min(1, key('errors.slugRequired'))
			.max(64, key('errors.slugMax'))
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, key('errors.slugPattern')),
		contactEmail: contactEmailSchema,
		contactPhone: z.string().trim().max(32, key('errors.phoneMax')),
		address: z.string().trim().max(1000, key('errors.addressMax')),
	}),
	administrator: administratorAccountSchema,
});
