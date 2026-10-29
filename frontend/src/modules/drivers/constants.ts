import type { ParseKeys } from 'i18next';
import type {
	CompensationType,
	DispatchStatus,
	DriverCategory,
	EmploymentClassification,
	EmploymentStatus,
	FleetArrangement,
} from './api';
import type { DriverFormValues } from './schemas/driverSchema';

// The ENUM values of the employees and delivery_drivers columns, in the order the screens list them. The form
// schema validates against the same lists.
export const DISPATCH_STATUSES: DispatchStatus[] = [
	'available',
	'on_pickup',
	'out_for_delivery',
	'off_duty',
	'suspended',
];

export const DRIVER_CATEGORIES = [
	'motorcycle',
	'van',
	'heavy_truck',
	'bicycle',
] as const satisfies readonly DriverCategory[];

export const FLEET_ARRANGEMENTS = [
	'company_vehicle',
	'owner_operator',
] as const satisfies readonly FleetArrangement[];

export const EMPLOYMENT_CLASSIFICATIONS = [
	'full_time',
	'part_time',
	'contractor',
	'owner',
] as const satisfies readonly EmploymentClassification[];

export const COMPENSATION_TYPES = [
	'commission_only',
	'hybrid',
	'hourly',
	'fixed_salary',
] as const satisfies readonly CompensationType[];

export const EMPLOYMENT_STATUSES = [
	'active',
	'probation',
	'on_leave',
	'terminated',
] as const satisfies readonly EmploymentStatus[];

// The duty statuses a person sets by hand. On pickup and out for delivery come from dispatch once parcels exist.
export const MANUAL_DISPATCH_STATUSES: DispatchStatus[] = ['available', 'off_duty', 'suspended'];

// The new driver form starts empty, as an active commission-only motorcycle courier on the company fleet.
export const DRIVER_DEFAULT_VALUES: DriverFormValues = {
	employeeCode: '',
	firstName: '',
	lastName: '',
	personalMobile: '',
	personalEmail: '',
	nationalId: '',
	dateOfBirth: '',
	residentialAddress: '',
	emergencyContactName: '',
	emergencyContactPhone: '',
	employmentClassification: 'contractor',
	compensationType: 'commission_only',
	employmentStatus: 'active',
	hireDate: '',
	terminationDate: '',
	baseSalary: '0.00',
	bankName: '',
	bankAccountIban: '',
	driverCategory: 'motorcycle',
	fleetArrangement: 'company_vehicle',
	assignedZone: '',
	maxWeightCapacityKg: '0.00',
	maxVolumeCapacityM3: '0.00',
	commissionPerDrop: '0.00',
	licenseNumber: '',
	licenseClass: '',
	licenseExpiryDate: '',
	backgroundCheckPassed: false,
	backgroundCheckDate: '',
	transitInsurancePolicy: '',
	transitInsuranceExpiry: '',
};

// API refusals on saving a driver that belong to one form field.
export const DRIVER_FIELD_ERRORS = {
	EMPLOYEE_CODE_TAKEN: 'employeeCode',
	LICENSE_NUMBER_TAKEN: 'licenseNumber',
} as const;

// The API's codes for drivers, as translation keys. Anything else gets the general message.
export const DRIVER_ERROR_MESSAGES = {
	EMPLOYEE_CODE_TAKEN: 'errors.codeTaken',
	LICENSE_NUMBER_TAKEN: 'errors.licenseTaken',
	ACCOUNT_ALREADY_LINKED: 'errors.accountTaken',
	DRIVER_NOT_FOUND: 'errors.notFound',
} as const satisfies Record<string, ParseKeys<'drivers'>>;
