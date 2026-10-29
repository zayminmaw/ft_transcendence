// /api/drivers (planned): the couriers of the open company. A driver is an `employees` row (personnel_type
// 'driver') plus its `delivery_drivers` row; the API creates both together. Until the API exists, the hooks answer
// from the sample data in data/sampleDrivers.ts, with these shapes and the API's refusals.
export type DispatchStatus =
	'off_duty' | 'available' | 'on_pickup' | 'out_for_delivery' | 'suspended';

export type DriverCategory = 'motorcycle' | 'van' | 'heavy_truck' | 'bicycle';

export type FleetArrangement = 'company_vehicle' | 'owner_operator';

export type EmploymentClassification = 'full_time' | 'part_time' | 'contractor' | 'owner';

export type CompensationType = 'fixed_salary' | 'hourly' | 'commission_only' | 'hybrid';

export type EmploymentStatus = 'active' | 'on_leave' | 'probation' | 'terminated';

export type DriverStatusFilter = DispatchStatus | 'all';

export type DriverSortKey = 'lastName' | 'employeeCode' | 'hireDate';

export type DriverListParams = {
	search: string;
	status: DriverStatusFilter;
	sort: DriverSortKey;
	direction: 'asc' | 'desc';
	page: number;
	pageSize: number;
};

// The login account a driver uses; parcels later limit a driver to their own run through it.
export type DriverAccount = { userId: string; username: string };

// Dates are 'YYYY-MM-DD' strings (DATE columns); money and capacities stay strings like the DECIMAL columns.
export type Driver = {
	id: string;
	employeeCode: string;
	firstName: string;
	lastName: string;
	personalMobile: string;
	personalEmail: string;
	employmentClassification: EmploymentClassification;
	compensationType: CompensationType;
	employmentStatus: EmploymentStatus;
	hireDate: string;
	terminationDate: string | null;
	driverCategory: DriverCategory;
	fleetArrangement: FleetArrangement;
	assignedZone: string | null;
	maxWeightCapacityKg: string;
	maxVolumeCapacityM3: string;
	dispatchStatus: DispatchStatus;
	lastLocationPing: string | null;
	account: DriverAccount | null;
	// Only with drivers.manage: the API will leave them out otherwise.
	nationalId?: string;
	dateOfBirth?: string;
	residentialAddress?: string;
	emergencyContactName?: string;
	emergencyContactPhone?: string;
	// Only with staff.view_payroll.
	baseSalary?: string;
	bankName?: string | null;
	bankAccountIban?: string | null;
	// Only with drivers.view_compliance.
	licenseNumber?: string;
	licenseClass?: string;
	licenseExpiryDate?: string;
	backgroundCheckPassed?: boolean;
	backgroundCheckDate?: string | null;
	transitInsurancePolicy?: string | null;
	transitInsuranceExpiry?: string | null;
	// Only with drivers.view_earnings.
	commissionPerDrop?: string;
	createdAt: string;
	updatedAt: string;
};

export type DriverList = {
	items: Driver[];
	total: number;
	page: number;
	pageSize: number;
	// Over the whole company, whatever the search and filter. Terminated drivers are left out of the duty counts;
	// `licensesExpiring` is active drivers whose license expires within LICENSE_WARNING_DAYS or has expired.
	counts: {
		total: number;
		available: number;
		onRun: number;
		offDuty: number;
		suspended: number;
		licensesExpiring: number;
	};
};

// What the driver form sends. Fields a person may not see are left out and keep their value.
export type DriverValues = Omit<
	Driver,
	'id' | 'dispatchStatus' | 'lastLocationPing' | 'account' | 'createdAt' | 'updatedAt'
>;
