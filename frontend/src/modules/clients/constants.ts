import type { ParseKeys } from 'i18next';
import type { ClientFormValues } from './schemas/clientSchema';

// rate_profile_tier is free text in the database; these are the tiers the screens offer. New clients start on
// the first.
export const RATE_TIERS = ['standard', 'priority', 'corporate'] as const;
export type RateTier = (typeof RATE_TIERS)[number];
export const DEFAULT_RATE_TIER: RateTier = 'standard';

// The new client form starts empty, on the default rate.
export const CLIENT_DEFAULT_VALUES: ClientFormValues = {
	clientCode: '',
	businessName: '',
	tradeLicenseNo: '',
	contactPersonName: '',
	contactTitle: '',
	mobile1: '',
	mobile2: '',
	email: '',
	billingAddress: '',
	defaultPickupAddress: '',
	pickupLatitude: '',
	pickupLongitude: '',
	rateProfileTier: DEFAULT_RATE_TIER,
	operationalNotes: '',
};

// API refusals on saving a client that belong to one form field.
export const CLIENT_FIELD_ERRORS = {
	CLIENT_CODE_TAKEN: 'clientCode',
} as const;

// The API's codes for clients, as translation keys. Anything else gets the general message.
export const CLIENT_ERROR_MESSAGES = {
	CLIENT_CODE_TAKEN: 'errors.codeTaken',
	CLIENT_NOT_FOUND: 'errors.notFound',
} as const satisfies Record<string, ParseKeys<'clients'>>;
