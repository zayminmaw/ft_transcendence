import type { ParseKeys } from 'i18next';
import type { AssetCategory, AssetCondition, AssetStatusFilter } from './api';
import type { AssetFormValues } from './schemas/assetSchema';
import type { MaintenanceFormValues } from './schemas/maintenanceSchema';

// The ENUM values of the `assets` columns, in the order the screens list them. The form schema validates against
// the same lists.
export const ASSET_CATEGORIES = [
	'motorcycle',
	'van',
	'thermal_bag',
	'barcode_scanner',
	'mobile_pos',
	'other',
] as const satisfies readonly AssetCategory[];

export const ASSET_CONDITIONS = [
	'new',
	'good',
	'needs_maintenance',
	'decommissioned',
] as const satisfies readonly AssetCondition[];

// The conditions an asset can come back in from a driver or the workshop; retiring it is done from the edit form.
export const RETURN_CONDITIONS = [
	'good',
	'needs_maintenance',
] as const satisfies readonly AssetCondition[];

// Plate, VIN, insurance and road tax belong to these; for the others the form hides them.
export const VEHICLE_CATEGORIES: AssetCategory[] = ['motorcycle', 'van'];

// The list's status filter, after "All".
export const ASSET_STATUSES: Exclude<AssetStatusFilter, 'all'>[] = [
	'available',
	'checked_out',
	'needs_maintenance',
	'decommissioned',
];

// The new asset form starts empty, as a new motorcycle.
export const ASSET_DEFAULT_VALUES: AssetFormValues = {
	assetTag: '',
	assetName: '',
	category: 'motorcycle',
	currentCondition: 'new',
	acquisitionCost: '0.00',
	currentBookValue: '0.00',
	licensePlate: '',
	vin: '',
	insurancePolicyNumber: '',
	roadTaxExpiry: '',
	notes: '',
};

// A new service log entry is free of charge until filled in and leaves the asset good. The service date is set to
// today when the dialog opens.
export const MAINTENANCE_DEFAULT_VALUES: MaintenanceFormValues = {
	serviceDate: '',
	serviceType: '',
	serviceCost: '0.00',
	vendorServiceCenter: '',
	nextServiceDue: '',
	notes: '',
	condition: 'good',
};

// API refusals on saving an asset that belong to one form field.
export const ASSET_FIELD_ERRORS = {
	ASSET_TAG_TAKEN: 'assetTag',
	ASSET_CHECKED_OUT: 'currentCondition',
} as const;

// The API's codes for assets, as translation keys. Anything else gets the general message.
export const ASSET_ERROR_MESSAGES = {
	ASSET_TAG_TAKEN: 'errors.tagTaken',
	ASSET_CHECKED_OUT: 'errors.checkedOut',
	ASSET_ALREADY_CHECKED_OUT: 'errors.alreadyCheckedOut',
	ASSET_NOT_CHECKED_OUT: 'errors.notCheckedOut',
	ASSET_DECOMMISSIONED: 'errors.decommissioned',
	ASSET_NOT_FOUND: 'errors.notFound',
} as const satisfies Record<string, ParseKeys<'assets'>>;
