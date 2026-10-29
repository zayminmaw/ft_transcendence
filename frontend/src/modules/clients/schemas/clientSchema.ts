import type { ParseKeys } from 'i18next';
import { z } from 'zod';

const key = (value: ParseKeys<'clients'>) => value;

const required = (max: number) =>
	z.string().trim().min(1, key('errors.required')).max(max, key('errors.tooLong'));

const optional = (max: number) => z.string().trim().max(max, key('errors.tooLong'));

const phone = z
	.string()
	.trim()
	.regex(/^\+?[0-9 ()-]{6,32}$/, key('errors.invalidPhone'));

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
		clientCode: z
			.string()
			.trim()
			.toUpperCase()
			.regex(/^[A-Z0-9-]{2,32}$/, key('errors.invalidCode')),
		businessName: required(191),
		tradeLicenseNo: optional(128),
		contactPersonName: required(128),
		contactTitle: optional(64),
		mobile1: phone,
		mobile2: z.union([z.literal(''), phone]),
		email: z
			.string()
			.trim()
			.max(191, key('errors.tooLong'))
			.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, key('errors.invalidEmail')),
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
