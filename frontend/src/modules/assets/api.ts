// /api/assets (planned): the open company's vehicles and equipment, who has them, and their service history. Until
// the API exists, the hooks answer from the sample data in data/sampleAssets.ts, with these shapes and the API's
// refusals.
export type AssetCategory =
	'motorcycle' | 'van' | 'thermal_bag' | 'barcode_scanner' | 'mobile_pos' | 'other';

export type AssetCondition = 'new' | 'good' | 'needs_maintenance' | 'decommissioned';

// Available: in the depot and fit to go out. Checked out: with a driver. The others are the condition.
export type AssetStatusFilter =
	'all' | 'available' | 'checked_out' | 'needs_maintenance' | 'decommissioned';

export type AssetSortKey = 'assetTag' | 'assetName';

export type AssetListParams = {
	search: string;
	status: AssetStatusFilter;
	sort: AssetSortKey;
	direction: 'asc' | 'desc';
	page: number;
	pageSize: number;
};

// The driver holding an asset, from the `asset_assignments` row without a checked_in_at.
export type AssetHolder = {
	assignmentId: string;
	driverId: string;
	driverName: string;
	checkedOutAt: string;
	checkoutNotes: string | null;
};

// Dates are 'YYYY-MM-DD' strings (DATE columns); money stays a string like the DECIMAL columns.
export type Asset = {
	id: string;
	assetTag: string;
	assetName: string;
	category: AssetCategory;
	acquisitionCost: string;
	currentBookValue: string;
	licensePlate: string | null;
	vin: string | null;
	insurancePolicyNumber: string | null;
	roadTaxExpiry: string | null;
	currentCondition: AssetCondition;
	notes: string | null;
	holder: AssetHolder | null;
	// From the latest service log entry that set one.
	nextServiceDue: string | null;
	createdAt: string;
	updatedAt: string;
};

// A past check-out, newest first.
export type AssetAssignment = {
	id: string;
	driverId: string;
	driverName: string;
	checkedOutAt: string;
	checkedInAt: string | null;
	checkoutNotes: string | null;
	checkinNotes: string | null;
};

export type MaintenanceLog = {
	id: string;
	serviceDate: string;
	serviceType: string;
	serviceCost: string;
	vendorServiceCenter: string | null;
	nextServiceDue: string | null;
	notes: string | null;
	createdAt: string;
};

// GET /api/assets/:id: the asset with its check-out history and service log, newest first.
export type AssetDetails = Asset & {
	assignments: AssetAssignment[];
	maintenanceLogs: MaintenanceLog[];
};

export type AssetList = {
	items: Asset[];
	total: number;
	page: number;
	pageSize: number;
	// Over the whole company, whatever the search and filter. Decommissioned assets are left out of every count
	// but their own; `roadTaxDue` is road tax that has expired or expires within EXPIRY_WARNING_DAYS.
	counts: {
		inService: number;
		checkedOut: number;
		needsMaintenance: number;
		decommissioned: number;
		roadTaxDue: number;
	};
};

// What the asset form sends.
export type AssetValues = Omit<
	Asset,
	'id' | 'holder' | 'nextServiceDue' | 'createdAt' | 'updatedAt'
>;

export type CheckOutValues = { driverId: string; notes: string | null };

// Checking in can also record the condition it came back in.
export type CheckInValues = { condition: AssetCondition; notes: string | null };

// Logging a service also sets the condition it left the workshop in.
export type MaintenanceValues = Omit<MaintenanceLog, 'id' | 'createdAt'> & {
	condition: AssetCondition;
};
