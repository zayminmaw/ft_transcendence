import { ApiError } from '@services/api-client';
import { expiryState } from '@utils/expiry';
import type {
	DispatchStatus,
	Driver,
	DriverAccount,
	DriverChoice,
	DriverList,
	DriverListParams,
	DriverValues,
} from '../api';

// Sample couriers until /api/drivers exists. Fields mirror the `employees` and `delivery_drivers` tables.
const sampleDrivers: Driver[] = [
	{
		id: '21',
		employeeCode: 'DRV-001',
		firstName: 'Leen',
		lastName: 'Mansour',
		personalMobile: '+962 7 9555 2101',
		personalEmail: 'leen.mansour@mail.example.test',
		nationalId: '9881023344',
		dateOfBirth: '1994-05-12',
		residentialAddress: '8 Al Rabiah Street, Amman',
		emergencyContactName: 'Nadia Mansour',
		emergencyContactPhone: '+962 7 9555 2102',
		employmentClassification: 'full_time',
		compensationType: 'hybrid',
		employmentStatus: 'active',
		hireDate: '2025-02-01',
		terminationDate: null,
		baseSalary: '350.00',
		bankName: 'Arab Bank',
		bankAccountIban: 'JO94CBJO0010000000000131000302',
		driverCategory: 'van',
		fleetArrangement: 'company_vehicle',
		assignedZone: 'East',
		maxWeightCapacityKg: '800.00',
		maxVolumeCapacityM3: '6.50',
		dispatchStatus: 'available',
		lastLocationPing: '2026-10-29T08:41:00Z',
		account: null,
		licenseNumber: 'JO-DL-4410982',
		licenseClass: 'C',
		licenseExpiryDate: '2028-03-15',
		backgroundCheckPassed: true,
		backgroundCheckDate: '2025-01-20',
		transitInsurancePolicy: 'GIT-22018',
		transitInsuranceExpiry: '2027-01-31',
		commissionPerDrop: '0.75',
		createdAt: '2025-02-01T08:00:00Z',
		updatedAt: '2026-10-20T09:00:00Z',
	},
	{
		id: '22',
		employeeCode: 'DRV-002',
		firstName: 'Samir',
		lastName: 'Farah',
		personalMobile: '+962 7 9555 2201',
		personalEmail: 'samir.farah@mail.example.test',
		nationalId: '9900417781',
		dateOfBirth: '1998-11-03',
		residentialAddress: '41 Jabal Al Hussein, Amman',
		emergencyContactName: 'Rima Farah',
		emergencyContactPhone: '+962 7 9555 2202',
		employmentClassification: 'contractor',
		compensationType: 'commission_only',
		employmentStatus: 'active',
		hireDate: '2025-06-15',
		terminationDate: null,
		baseSalary: '0.00',
		bankName: 'Housing Bank',
		bankAccountIban: 'JO71HBHO0320000000000412300101',
		driverCategory: 'motorcycle',
		fleetArrangement: 'owner_operator',
		assignedZone: 'Central',
		maxWeightCapacityKg: '40.00',
		maxVolumeCapacityM3: '0.20',
		dispatchStatus: 'available',
		lastLocationPing: '2026-10-29T08:55:00Z',
		account: { userId: '7', username: 'samir.farah' },
		licenseNumber: 'JO-DL-5520411',
		licenseClass: 'A',
		licenseExpiryDate: '2026-11-18',
		backgroundCheckPassed: true,
		backgroundCheckDate: '2025-06-01',
		transitInsurancePolicy: null,
		transitInsuranceExpiry: null,
		commissionPerDrop: '1.10',
		createdAt: '2025-06-15T08:00:00Z',
		updatedAt: '2026-10-27T15:30:00Z',
	},
	{
		id: '23',
		employeeCode: 'DRV-003',
		firstName: 'Hadi',
		lastName: 'Salim',
		personalMobile: '+962 7 9555 2301',
		personalEmail: 'hadi.salim@mail.example.test',
		nationalId: '9851200456',
		dateOfBirth: '1985-01-27',
		residentialAddress: '17 Tla Al Ali, Amman',
		emergencyContactName: 'Huda Salim',
		emergencyContactPhone: '+962 7 9555 2302',
		employmentClassification: 'full_time',
		compensationType: 'fixed_salary',
		employmentStatus: 'active',
		hireDate: '2024-09-01',
		terminationDate: null,
		baseSalary: '520.00',
		bankName: 'Arab Bank',
		bankAccountIban: 'JO32CBJO0010000000000187600455',
		driverCategory: 'van',
		fleetArrangement: 'company_vehicle',
		assignedZone: 'West',
		maxWeightCapacityKg: '750.00',
		maxVolumeCapacityM3: '6.00',
		dispatchStatus: 'out_for_delivery',
		lastLocationPing: '2026-10-29T09:02:00Z',
		account: null,
		licenseNumber: 'JO-DL-3301877',
		licenseClass: 'C',
		licenseExpiryDate: '2027-08-09',
		backgroundCheckPassed: true,
		backgroundCheckDate: '2024-08-20',
		transitInsurancePolicy: 'GIT-21544',
		transitInsuranceExpiry: '2026-11-30',
		commissionPerDrop: '0.00',
		createdAt: '2024-09-01T08:00:00Z',
		updatedAt: '2026-10-29T07:10:00Z',
	},
	{
		id: '24',
		employeeCode: 'DRV-004',
		firstName: 'Omar',
		lastName: 'Kanaan',
		personalMobile: '+962 7 9555 2401',
		personalEmail: 'omar.kanaan@mail.example.test',
		nationalId: '2001336790',
		dateOfBirth: '2001-07-19',
		residentialAddress: '5 University Street, Amman',
		emergencyContactName: 'Fadi Kanaan',
		emergencyContactPhone: '+962 7 9555 2402',
		employmentClassification: 'part_time',
		compensationType: 'commission_only',
		employmentStatus: 'probation',
		hireDate: '2026-09-10',
		terminationDate: null,
		baseSalary: '0.00',
		bankName: null,
		bankAccountIban: null,
		driverCategory: 'bicycle',
		fleetArrangement: 'owner_operator',
		assignedZone: 'Central',
		maxWeightCapacityKg: '15.00',
		maxVolumeCapacityM3: '0.08',
		dispatchStatus: 'off_duty',
		lastLocationPing: null,
		account: null,
		licenseNumber: 'JO-CY-0099102',
		licenseClass: 'Bicycle',
		licenseExpiryDate: '2029-09-01',
		backgroundCheckPassed: false,
		backgroundCheckDate: null,
		transitInsurancePolicy: null,
		transitInsuranceExpiry: null,
		commissionPerDrop: '0.90',
		createdAt: '2026-09-10T08:00:00Z',
		updatedAt: '2026-09-10T08:00:00Z',
	},
	{
		id: '25',
		employeeCode: 'DRV-005',
		firstName: 'Rami',
		lastName: 'Haddad',
		personalMobile: '+962 7 9555 2501',
		personalEmail: 'rami.haddad@mail.example.test',
		nationalId: '9790281145',
		dateOfBirth: '1979-03-30',
		residentialAddress: '12 Marka Street, Amman',
		emergencyContactName: 'Laila Haddad',
		emergencyContactPhone: '+962 7 9555 2502',
		employmentClassification: 'full_time',
		compensationType: 'hybrid',
		employmentStatus: 'on_leave',
		hireDate: '2023-04-03',
		terminationDate: null,
		baseSalary: '300.00',
		bankName: 'Jordan Kuwait Bank',
		bankAccountIban: 'JO15JKBA1100000000000233000771',
		driverCategory: 'heavy_truck',
		fleetArrangement: 'company_vehicle',
		assignedZone: 'Industrial',
		maxWeightCapacityKg: '3500.00',
		maxVolumeCapacityM3: '24.00',
		dispatchStatus: 'suspended',
		lastLocationPing: '2026-10-01T16:20:00Z',
		account: null,
		licenseNumber: 'JO-DL-1188420',
		licenseClass: 'D',
		licenseExpiryDate: '2026-10-05',
		backgroundCheckPassed: true,
		backgroundCheckDate: '2023-03-15',
		transitInsurancePolicy: 'GIT-19002',
		transitInsuranceExpiry: '2027-04-02',
		commissionPerDrop: '0.50',
		createdAt: '2023-04-03T08:00:00Z',
		updatedAt: '2026-10-06T08:00:00Z',
	},
];

// Company members with the driver role, who can sign in as a driver.
const sampleDriverAccounts: DriverAccount[] = [
	{ userId: '7', username: 'samir.farah' },
	{ userId: '31', username: 'leen.mansour' },
	{ userId: '32', username: 'hadi.salim' },
];

// Stands in for the API: kept in memory (a reload starts over), answering with the API's shapes and refusals. Each
// answer is a copy, so the query cache never shares objects with it.
let drivers = structuredClone(sampleDrivers);

function find(id: string) {
	const driver = drivers.find((item) => item.id === id);
	if (!driver) throw new ApiError(404, 'Driver not found.', 'DRIVER_NOT_FOUND');
	return driver;
}

function checkUnique(values: DriverValues, exceptId?: string) {
	const others = drivers.filter((item) => item.id !== exceptId);
	if (others.some((item) => item.employeeCode === values.employeeCode))
		throw new ApiError(409, 'This employee code is already used.', 'EMPLOYEE_CODE_TAKEN');
	if (others.some((item) => item.licenseNumber === values.licenseNumber))
		throw new ApiError(
			409,
			'This license number is already registered.',
			'LICENSE_NUMBER_TAKEN',
		);
}

function save(driver: Driver) {
	drivers = drivers.some((item) => item.id === driver.id)
		? drivers.map((item) => (item.id === driver.id ? driver : item))
		: [...drivers, driver];
	return structuredClone(driver);
}

// Fields the form left out (e.g. payroll without staff.view_payroll) keep their saved value.
function definedOnly(values: DriverValues) {
	return Object.fromEntries(
		Object.entries(values).filter(([, value]) => value !== undefined),
	) as Partial<DriverValues>;
}

export const sampleDriversApi = {
	async list(params: DriverListParams): Promise<DriverList> {
		const needle = params.search.trim().toLowerCase();
		const matching = drivers.filter(
			(driver) =>
				(params.status === 'all' || driver.dispatchStatus === params.status) &&
				(!needle ||
					[
						driver.firstName,
						driver.lastName,
						driver.employeeCode,
						driver.personalMobile,
						driver.assignedZone ?? '',
					]
						.join(' ')
						.toLowerCase()
						.includes(needle)),
		);
		matching.sort((a, b) => {
			const order = a[params.sort].localeCompare(b[params.sort]);
			return params.direction === 'asc' ? order : -order;
		});
		const working = drivers.filter((driver) => driver.employmentStatus !== 'terminated');
		const withStatus = (...statuses: DispatchStatus[]) =>
			working.filter((driver) => statuses.includes(driver.dispatchStatus)).length;
		return structuredClone({
			items: matching.slice(
				(params.page - 1) * params.pageSize,
				params.page * params.pageSize,
			),
			total: matching.length,
			page: params.page,
			pageSize: params.pageSize,
			counts: {
				total: working.length,
				available: withStatus('available'),
				onRun: withStatus('on_pickup', 'out_for_delivery'),
				offDuty: withStatus('off_duty'),
				suspended: withStatus('suspended'),
				licensesExpiring: working.filter(
					(driver) =>
						driver.licenseExpiryDate &&
						expiryState(driver.licenseExpiryDate) !== 'valid',
				).length,
			},
		});
	},

	async get(id: string) {
		return structuredClone(find(id));
	},

	// Everyone still employed, by last name.
	async choices(): Promise<DriverChoice[]> {
		return drivers
			.filter((driver) => driver.employmentStatus !== 'terminated')
			.sort((a, b) => a.lastName.localeCompare(b.lastName))
			.map((driver) => ({
				id: driver.id,
				name: `${driver.firstName} ${driver.lastName}`,
				employeeCode: driver.employeeCode,
			}));
	},

	// A new driver starts off duty, without a login account.
	async create(values: DriverValues) {
		checkUnique(values);
		const now = new Date().toISOString();
		return save({
			...values,
			id: String(Math.max(0, ...drivers.map((item) => Number(item.id))) + 1),
			dispatchStatus: 'off_duty',
			lastLocationPing: null,
			account: null,
			createdAt: now,
			updatedAt: now,
		});
	},

	// Ending employment also takes the driver off duty.
	async update(id: string, values: DriverValues) {
		const current = find(id);
		checkUnique(values, id);
		const updated: Driver = {
			...current,
			...definedOnly(values),
			updatedAt: new Date().toISOString(),
		};
		if (updated.employmentStatus === 'terminated') updated.dispatchStatus = 'off_duty';
		return save(updated);
	},

	async setDispatchStatus(id: string, dispatchStatus: DispatchStatus) {
		return save({ ...find(id), dispatchStatus, updatedAt: new Date().toISOString() });
	},

	// The driver-role accounts not linked to another driver yet.
	async linkableAccounts() {
		const linked = new Set(drivers.map((driver) => driver.account?.userId));
		return structuredClone(
			sampleDriverAccounts.filter((account) => !linked.has(account.userId)),
		);
	},

	// Links a login account to the driver, or unlinks it (null).
	async linkAccount(id: string, userId: string | null) {
		const driver = find(id);
		if (userId && drivers.some((item) => item.id !== id && item.account?.userId === userId))
			throw new ApiError(
				409,
				'This account is linked to another driver.',
				'ACCOUNT_ALREADY_LINKED',
			);
		const account = sampleDriverAccounts.find((item) => item.userId === userId) ?? null;
		return save({ ...driver, account, updatedAt: new Date().toISOString() });
	},
};
