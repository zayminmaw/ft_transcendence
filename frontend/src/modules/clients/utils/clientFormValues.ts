import type { Client, ClientValues } from '../api';
import { DEFAULT_RATE_TIER } from '../constants';
import type { ClientFormOutput, ClientFormValues } from '../schemas/clientSchema';

// Empty optional fields are sent as null, like the nullable columns.
export function toClientValues(values: ClientFormOutput, withTier: boolean): ClientValues {
	const orNull = (value: string) => value || null;
	return {
		...values,
		tradeLicenseNo: orNull(values.tradeLicenseNo),
		contactTitle: orNull(values.contactTitle),
		mobile2: orNull(values.mobile2),
		pickupLatitude: orNull(values.pickupLatitude),
		pickupLongitude: orNull(values.pickupLongitude),
		operationalNotes: orNull(values.operationalNotes),
		rateProfileTier: withTier ? values.rateProfileTier : undefined,
	};
}

// A saved client as form fields: nulls become empty fields.
export function toClientFormValues(client: Client): ClientFormValues {
	return {
		clientCode: client.clientCode,
		businessName: client.businessName,
		tradeLicenseNo: client.tradeLicenseNo ?? '',
		contactPersonName: client.contactPersonName,
		contactTitle: client.contactTitle ?? '',
		mobile1: client.mobile1,
		mobile2: client.mobile2 ?? '',
		email: client.email,
		billingAddress: client.billingAddress,
		defaultPickupAddress: client.defaultPickupAddress,
		pickupLatitude: client.pickupLatitude ?? '',
		pickupLongitude: client.pickupLongitude ?? '',
		rateProfileTier: client.rateProfileTier ?? DEFAULT_RATE_TIER,
		operationalNotes: client.operationalNotes ?? '',
	};
}
