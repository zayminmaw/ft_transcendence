import type { Asset, AssetValues } from '../api';
import { VEHICLE_CATEGORIES } from '../constants';
import type { AssetFormOutput, AssetFormValues } from '../schemas/assetSchema';

// Empty optional fields are sent as null, like the nullable columns. Plate, VIN, insurance and road tax are only
// kept for vehicles; the form hides them for anything else.
export function toAssetValues(values: AssetFormOutput): AssetValues {
	const vehicle = VEHICLE_CATEGORIES.includes(values.category);
	const orNull = (value: string) => (vehicle && value) || null;
	return {
		...values,
		licensePlate: orNull(values.licensePlate),
		vin: orNull(values.vin),
		insurancePolicyNumber: orNull(values.insurancePolicyNumber),
		roadTaxExpiry: orNull(values.roadTaxExpiry),
		notes: values.notes || null,
	};
}

// A saved asset as form fields: nulls become empty fields.
export function toAssetFormValues(asset: Asset): AssetFormValues {
	return {
		assetTag: asset.assetTag,
		assetName: asset.assetName,
		category: asset.category,
		currentCondition: asset.currentCondition,
		acquisitionCost: asset.acquisitionCost,
		currentBookValue: asset.currentBookValue,
		licensePlate: asset.licensePlate ?? '',
		vin: asset.vin ?? '',
		insurancePolicyNumber: asset.insurancePolicyNumber ?? '',
		roadTaxExpiry: asset.roadTaxExpiry ?? '',
		notes: asset.notes ?? '',
	};
}
