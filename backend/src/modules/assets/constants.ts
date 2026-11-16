// The ENUM values of the `assets` columns, in the order the screens list them.
export const ASSET_CATEGORIES = ['motorcycle', 'van', 'thermal_bag', 'barcode_scanner', 'mobile_pos', 'other'] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];
export const ASSET_CONDITIONS = ['new', 'good', 'needs_maintenance', 'decommissioned'] as const;
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];
// The conditions an asset comes back in from a driver or the workshop. Retiring it is an edit.
export const RETURN_CONDITIONS = ['good', 'needs_maintenance'] as const satisfies readonly AssetCondition[];
// Fit to go out when nobody has it.
export const READY_CONDITIONS = ['new', 'good'] as const satisfies readonly AssetCondition[];

// Available: in the depot and fit to go out. Checked out: with a driver. The others are the condition.
export const ASSET_STATUS_FILTERS = ['all', 'available', 'checked_out', 'needs_maintenance', 'decommissioned'] as const;
export type AssetStatusFilter = (typeof ASSET_STATUS_FILTERS)[number];
export const ASSET_SORTS = ['assetTag', 'assetName'] as const;
// Free text: the notes of an asset, a check-out, a check-in or a service.
export const NOTES_MAX_LENGTH = 2000;

// The columns the asset form sets.
export const ASSET_FIELDS = [
  'assetTag', 'assetName', 'category', 'acquisitionCost', 'currentBookValue', 'licensePlate', 'vin', 'insurancePolicyNumber',
  'roadTaxExpiry', 'currentCondition', 'notes',
] as const;

export const ASSET_NOT_FOUND = { message: "That asset isn't in this company.", code: 'ASSET_NOT_FOUND' };
export const ASSET_TAG_TAKEN = { message: 'This asset tag is already used.', code: 'ASSET_TAG_TAKEN' };
export const ASSET_CHECKED_OUT = { message: 'Check the asset in before decommissioning it.', code: 'ASSET_CHECKED_OUT' };
export const ASSET_ALREADY_CHECKED_OUT = { message: 'This asset is already checked out.', code: 'ASSET_ALREADY_CHECKED_OUT' };
export const ASSET_NOT_CHECKED_OUT = { message: 'This asset is not checked out.', code: 'ASSET_NOT_CHECKED_OUT' };
export const ASSET_DECOMMISSIONED = { message: 'This asset is decommissioned.', code: 'ASSET_DECOMMISSIONED' };
export const ASSET_DRIVER_UNAVAILABLE = {
  message: 'Only a driver still employed by this company can take an asset.',
  code: 'ASSET_DRIVER_UNAVAILABLE',
};
export const SERVICE_DUE_BEFORE_SERVICE = {
  message: 'The next service must be after the service date.',
  code: 'SERVICE_DUE_BEFORE_SERVICE',
};
