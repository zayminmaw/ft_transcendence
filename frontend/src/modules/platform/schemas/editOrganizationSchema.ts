import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import { EMAIL_MAX_LENGTH, EMAIL_PATTERN } from '@utils/form-rules';

// Messages are translation keys, translated when shown.
const key = (value: ParseKeys<'platform'>) => value;

// A company's contact address: the API's general email check, not the stricter one for login accounts.
export const contactEmailSchema = z
	.string()
	.trim()
	.min(1, key('errors.emailRequired'))
	.max(EMAIL_MAX_LENGTH, key('errors.emailMax'))
	.regex(EMAIL_PATTERN, key('errors.email'));

// The organization details a platform admin can edit. The slug is not here: it is part of every company link.
export const editOrganizationSchema = z.object({
	name: z.string().trim().min(1, key('errors.nameRequired')).max(191),
	contactEmail: contactEmailSchema,
	contactPhone: z.string().trim().max(32, key('errors.phoneMax')),
	address: z.string().trim().max(1000, key('errors.addressMax')),
});
