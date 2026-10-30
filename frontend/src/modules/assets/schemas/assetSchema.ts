import { z } from 'zod';
import { ASSET_CATEGORIES, ASSET_CONDITIONS } from '../constants';
import { key, money, optional, optionalDate, required } from './fields';

// The same limits as the `assets` columns. Messages are translation keys, translated when shown.
export const assetSchema = z.object({
	assetTag: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-Z0-9-]{2,64}$/, key('errors.invalidTag')),
	assetName: required(128),
	category: z.enum(ASSET_CATEGORIES),
	currentCondition: z.enum(ASSET_CONDITIONS),
	acquisitionCost: money,
	currentBookValue: money,
	licensePlate: optional(32),
	vin: optional(64),
	insurancePolicyNumber: optional(64),
	roadTaxExpiry: optionalDate,
	notes: optional(2000),
});

// What the form fields hold, and what the schema turns them into (trimmed, the tag in capitals).
export type AssetFormValues = z.input<typeof assetSchema>;
export type AssetFormOutput = z.output<typeof assetSchema>;
