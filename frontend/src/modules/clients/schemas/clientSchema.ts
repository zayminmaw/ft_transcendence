import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import { code, email, optional, phone, required } from '@utils/form-rules';

const key = (value: ParseKeys<'clients'>) => value;

const coordinate = (limit: number) =>
	z
		.string()
		.trim()
		.refine(
			(value) =>
				value === '' ||
				(/^-?\d{1,3}(\.\d{1,8})?$/.test(value) && Math.abs(Number(value)) <= limit),
			key('errors.invalidCoordinate'),
		);

// The same limits as the `clients` columns. Messages are translation keys, translated when shown.
export const clientSchema = z
	.object({
		clientCode: code(32),
		businessName: required(191),
		tradeLicenseNo: optional(128),
		contactPersonName: required(128),
		contactTitle: optional(64),
		mobile1: phone,
		mobile2: z.union([z.literal(''), phone]),
		email,
		billingAddress: required(2000),
		defaultPickupAddress: required(2000),
		pickupLatitude: coordinate(90),
		pickupLongitude: coordinate(180),
		rateProfileTier: z.string(),
		operationalNotes: optional(2000),
	})
	.refine((values) => (values.pickupLatitude === '') === (values.pickupLongitude === ''), {
		path: ['pickupLongitude'],
		message: key('errors.coordinatePair'),
	});

// What the form fields hold, and what the schema turns them into (trimmed, the code in capitals).
export type ClientFormValues = z.input<typeof clientSchema>;
export type ClientFormOutput = z.output<typeof clientSchema>;
