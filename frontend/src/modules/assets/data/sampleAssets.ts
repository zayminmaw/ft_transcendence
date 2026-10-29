import { ApiError } from '@services/api-client';
import { expiryState } from '@utils/expiry';
import type {
	Asset,
	AssetDetails,
	AssetHolder,
	AssetList,
	AssetListParams,
	AssetValues,
	CheckInValues,
	CheckOutValues,
	MaintenanceValues,
} from '../api';

// What the sample keeps per asset, like the three tables: the holder and next service are worked out from the
// assignments and the service log when answering.
type StoredAsset = Omit<AssetDetails, 'holder' | 'nextServiceDue'>;

// Sample fleet until /api/assets exists. Fields mirror the `assets`, `asset_assignments` and
// `asset_maintenance_logs` tables; drivers are the sample drivers (21 to 25).
const sampleAssets: StoredAsset[] = [
	{
		id: '41',
		assetTag: 'AST-001',
		assetName: 'Toyota Hiace',
		category: 'van',
		acquisitionCost: '24500.00',
		currentBookValue: '19600.00',
		licensePlate: '21-48812',
		vin: 'JTFSS22P0K0123456',
		insurancePolicyNumber: 'VAN-55021',
		roadTaxExpiry: '2027-02-28',
		currentCondition: 'good',
		notes: null,
		assignments: [
			{
				id: '103',
				driverId: '21',
				driverName: 'Leen Mansour',
				checkedOutAt: '2026-10-29T07:30:00Z',
				checkedInAt: null,
				checkoutNotes: 'Fuel full, 84,210 km',
				checkinNotes: null,
			},
			{
				id: '98',
				driverId: '21',
				driverName: 'Leen Mansour',
				checkedOutAt: '2026-10-28T07:20:00Z',
				checkedInAt: '2026-10-28T18:05:00Z',
				checkoutNotes: null,
				checkinNotes: 'No issues',
			},
		],
		maintenanceLogs: [
			{
				id: '61',
				serviceDate: '2026-09-14',
				serviceType: 'Oil and filter change',
				serviceCost: '85.00',
				vendorServiceCenter: 'Al Wehdat Auto Service',
				nextServiceDue: '2026-12-14',
				notes: null,
				createdAt: '2026-09-14T12:00:00Z',
			},
		],
		createdAt: '2025-02-01T08:00:00Z',
		updatedAt: '2026-10-29T07:30:00Z',
	},
	{
		id: '42',
		assetTag: 'AST-002',
		assetName: 'Toyota Hiace',
		category: 'van',
		acquisitionCost: '24500.00',
		currentBookValue: '18900.00',
		licensePlate: '21-48813',
		vin: 'JTFSS22P0K0123457',
		insurancePolicyNumber: 'VAN-55022',
		roadTaxExpiry: '2026-11-10',
		currentCondition: 'needs_maintenance',
		notes: 'Brakes squeal under load.',
		assignments: [
			{
				id: '95',
				driverId: '23',
				driverName: 'Hadi Salim',
				checkedOutAt: '2026-10-20T07:10:00Z',
				checkedInAt: '2026-10-27T17:40:00Z',
				checkoutNotes: null,
				checkinNotes: 'Brakes squeal under load',
			},
		],
		maintenanceLogs: [
			{
				id: '58',
				serviceDate: '2026-06-02',
				serviceType: 'Annual inspection',
				serviceCost: '140.00',
				vendorServiceCenter: 'Al Wehdat Auto Service',
				nextServiceDue: '2026-10-25',
				notes: 'Front pads at 30%.',
				createdAt: '2026-06-02T12:00:00Z',
			},
		],
		createdAt: '2025-02-01T08:00:00Z',
		updatedAt: '2026-10-27T17:40:00Z',
	},
	{
		id: '43',
		assetTag: 'AST-003',
		assetName: 'Hyundai H100',
		category: 'van',
		acquisitionCost: '19800.00',
		currentBookValue: '12400.00',
		licensePlate: '21-50290',
		vin: 'KMFZCZ7KAJU004821',
		insurancePolicyNumber: 'VAN-49110',
		roadTaxExpiry: '2027-06-30',
		currentCondition: 'good',
		notes: null,
		assignments: [
			{
				id: '104',
				driverId: '23',
				driverName: 'Hadi Salim',
				checkedOutAt: '2026-10-29T06:55:00Z',
				checkedInAt: null,
				checkoutNotes: null,
				checkinNotes: null,
			},
		],
		maintenanceLogs: [],
		createdAt: '2024-09-01T08:00:00Z',
		updatedAt: '2026-10-29T06:55:00Z',
	},
	{
		id: '44',
		assetTag: 'AST-004',
		assetName: 'Honda Wave 110',
		category: 'motorcycle',
		acquisitionCost: '1450.00',
		currentBookValue: '1450.00',
		licensePlate: '31-11902',
		vin: 'MLHJA3920P5100231',
		insurancePolicyNumber: 'MC-77012',
		roadTaxExpiry: '2027-09-15',
		currentCondition: 'new',
		notes: null,
		assignments: [],
		maintenanceLogs: [],
		createdAt: '2026-09-15T08:00:00Z',
		updatedAt: '2026-09-15T08:00:00Z',
	},
	{
		id: '45',
		assetTag: 'AST-005',
		assetName: 'Thermal bag, large',
		category: 'thermal_bag',
		acquisitionCost: '45.00',
		currentBookValue: '30.00',
		licensePlate: null,
		vin: null,
		insurancePolicyNumber: null,
		roadTaxExpiry: null,
		currentCondition: 'good',
		notes: null,
		assignments: [
			{
				id: '90',
				driverId: '22',
				driverName: 'Samir Farah',
				checkedOutAt: '2026-10-01T08:00:00Z',
				checkedInAt: null,
				checkoutNotes: null,
				checkinNotes: null,
			},
		],
		maintenanceLogs: [],
		createdAt: '2025-06-15T08:00:00Z',
		updatedAt: '2026-10-01T08:00:00Z',
	},
	{
		id: '46',
		assetTag: 'AST-006',
		assetName: 'Zebra TC21 scanner',
		category: 'barcode_scanner',
		acquisitionCost: '620.00',
		currentBookValue: '480.00',
		licensePlate: null,
		vin: null,
		insurancePolicyNumber: null,
		roadTaxExpiry: null,
		currentCondition: 'good',
		notes: 'Serial 21334B7720',
		assignments: [
			{
				id: '91',
				driverId: '22',
				driverName: 'Samir Farah',
				checkedOutAt: '2026-10-01T08:00:00Z',
				checkedInAt: null,
				checkoutNotes: 'With charging cradle',
				checkinNotes: null,
			},
		],
		maintenanceLogs: [],
		createdAt: '2025-06-15T08:00:00Z',
		updatedAt: '2026-10-01T08:00:00Z',
	},
	{
		id: '47',
		assetTag: 'AST-007',
		assetName: 'Sunmi P2 card terminal',
		category: 'mobile_pos',
		acquisitionCost: '310.00',
		currentBookValue: '260.00',
		licensePlate: null,
		vin: null,
		insurancePolicyNumber: null,
		roadTaxExpiry: null,
		currentCondition: 'good',
		notes: null,
		assignments: [],
		maintenanceLogs: [],
		createdAt: '2026-03-01T08:00:00Z',
		updatedAt: '2026-03-01T08:00:00Z',
	},
	{
		id: '48',
		assetTag: 'AST-008',
		assetName: 'Honda Wave 110',
		category: 'motorcycle',
		acquisitionCost: '1400.00',
		currentBookValue: '0.00',
		licensePlate: '31-09877',
		vin: 'MLHJA3920M5098812',
		insurancePolicyNumber: null,
		roadTaxExpiry: '2026-08-01',
		currentCondition: 'decommissioned',
		notes: 'Written off after an accident in July 2026.',
		assignments: [
			{
				id: '72',
				driverId: '22',
				driverName: 'Samir Farah',
				checkedOutAt: '2026-06-01T08:00:00Z',
				checkedInAt: '2026-07-18T16:00:00Z',
				checkoutNotes: null,
				checkinNotes: 'Damaged in an accident, frame bent',
			},
		],
		maintenanceLogs: [],
		createdAt: '2023-05-10T08:00:00Z',
		updatedAt: '2026-07-20T08:00:00Z',
	},
];

// Stands in for the API: kept in memory (a reload starts over), answering with the API's shapes and refusals. Each
// answer is a copy, so the query cache never shares objects with it.
let assets = structuredClone(sampleAssets);

const nextId = (ids: string[]) => String(Math.max(0, ...ids.map(Number)) + 1);

function find(id: string) {
	const asset = assets.find((item) => item.id === id);
	if (!asset) throw new ApiError(404, 'Asset not found.', 'ASSET_NOT_FOUND');
	return asset;
}

// The open assignment (not checked in yet) is who has the asset.
function holderOf(asset: StoredAsset): AssetHolder | null {
	const open = asset.assignments.find((item) => !item.checkedInAt);
	return open
		? {
				assignmentId: open.id,
				driverId: open.driverId,
				driverName: open.driverName,
				checkedOutAt: open.checkedOutAt,
				checkoutNotes: open.checkoutNotes,
			}
		: null;
}

function details(asset: StoredAsset): AssetDetails {
	return structuredClone({
		...asset,
		holder: holderOf(asset),
		nextServiceDue:
			asset.maintenanceLogs.find((log) => log.nextServiceDue)?.nextServiceDue ?? null,
	});
}

function save(asset: StoredAsset) {
	assets = assets.some((item) => item.id === asset.id)
		? assets.map((item) => (item.id === asset.id ? asset : item))
		: [...assets, asset];
	return details(asset);
}

function checkTag(values: AssetValues, exceptId?: string) {
	if (assets.some((item) => item.id !== exceptId && item.assetTag === values.assetTag))
		throw new ApiError(409, 'This asset tag is already used.', 'ASSET_TAG_TAKEN');
}

// The list answer carries no history, like GET /api/assets.
function summary(asset: StoredAsset): Asset {
	const { assignments, maintenanceLogs, ...rest } = details(asset);
	void assignments;
	void maintenanceLogs;
	return rest;
}

function matchesStatus(asset: StoredAsset, status: AssetListParams['status']) {
	switch (status) {
		case 'all':
			return true;
		case 'available':
			return !holderOf(asset) && ['new', 'good'].includes(asset.currentCondition);
		case 'checked_out':
			return holderOf(asset) !== null;
		default:
			return asset.currentCondition === status;
	}
}

export const sampleAssetsApi = {
	async list(params: AssetListParams): Promise<AssetList> {
		const needle = params.search.trim().toLowerCase();
		const matching = assets.filter(
			(asset) =>
				matchesStatus(asset, params.status) &&
				(!needle ||
					[
						asset.assetTag,
						asset.assetName,
						asset.licensePlate ?? '',
						holderOf(asset)?.driverName ?? '',
					]
						.join(' ')
						.toLowerCase()
						.includes(needle)),
		);
		matching.sort((a, b) => {
			const order = a[params.sort].localeCompare(b[params.sort]);
			return params.direction === 'asc' ? order : -order;
		});
		const inService = assets.filter((asset) => asset.currentCondition !== 'decommissioned');
		return structuredClone({
			items: matching
				.slice((params.page - 1) * params.pageSize, params.page * params.pageSize)
				.map(summary),
			total: matching.length,
			page: params.page,
			pageSize: params.pageSize,
			counts: {
				inService: inService.length,
				checkedOut: inService.filter((asset) => holderOf(asset)).length,
				needsMaintenance: inService.filter(
					(asset) => asset.currentCondition === 'needs_maintenance',
				).length,
				decommissioned: assets.length - inService.length,
				roadTaxDue: inService.filter(
					(asset) => asset.roadTaxExpiry && expiryState(asset.roadTaxExpiry) !== 'valid',
				).length,
			},
		});
	},

	async get(id: string) {
		return details(find(id));
	},

	async create(values: AssetValues) {
		checkTag(values);
		const now = new Date().toISOString();
		return save({
			...values,
			id: nextId(assets.map((item) => item.id)),
			assignments: [],
			maintenanceLogs: [],
			createdAt: now,
			updatedAt: now,
		});
	},

	// An asset with a driver has to be checked in before it's decommissioned.
	async update(id: string, values: AssetValues) {
		const current = find(id);
		checkTag(values, id);
		if (values.currentCondition === 'decommissioned' && holderOf(current))
			throw new ApiError(
				409,
				'Check the asset in before decommissioning it.',
				'ASSET_CHECKED_OUT',
			);
		return save({ ...current, ...values, updatedAt: new Date().toISOString() });
	},

	// One open assignment per asset; decommissioned assets don't go out. The API looks the driver's name up itself;
	// the sample takes it from the caller.
	async checkOut(id: string, { driverId, notes }: CheckOutValues, driverName: string) {
		const asset = find(id);
		if (asset.currentCondition === 'decommissioned')
			throw new ApiError(409, 'This asset is decommissioned.', 'ASSET_DECOMMISSIONED');
		if (holderOf(asset))
			throw new ApiError(
				409,
				'This asset is already checked out.',
				'ASSET_ALREADY_CHECKED_OUT',
			);
		const now = new Date().toISOString();
		return save({
			...asset,
			assignments: [
				{
					id: nextId(assets.flatMap((item) => item.assignments.map((a) => a.id))),
					driverId,
					driverName,
					checkedOutAt: now,
					checkedInAt: null,
					checkoutNotes: notes,
					checkinNotes: null,
				},
				...asset.assignments,
			],
			updatedAt: now,
		});
	},

	async checkIn(id: string, { condition, notes }: CheckInValues) {
		const asset = find(id);
		const holder = holderOf(asset);
		if (!holder)
			throw new ApiError(409, 'This asset is not checked out.', 'ASSET_NOT_CHECKED_OUT');
		const now = new Date().toISOString();
		return save({
			...asset,
			currentCondition: condition,
			assignments: asset.assignments.map((item) =>
				item.id === holder.assignmentId
					? { ...item, checkedInAt: now, checkinNotes: notes }
					: item,
			),
			updatedAt: now,
		});
	},

	// The log stays newest service first.
	async logMaintenance(id: string, { condition, ...log }: MaintenanceValues) {
		const asset = find(id);
		if (asset.currentCondition === 'decommissioned')
			throw new ApiError(409, 'This asset is decommissioned.', 'ASSET_DECOMMISSIONED');
		const now = new Date().toISOString();
		const entry = {
			...log,
			id: nextId(assets.flatMap((item) => item.maintenanceLogs.map((l) => l.id))),
			createdAt: now,
		};
		return save({
			...asset,
			currentCondition: condition,
			maintenanceLogs: [entry, ...asset.maintenanceLogs].sort((a, b) =>
				b.serviceDate.localeCompare(a.serviceDate),
			),
			updatedAt: now,
		});
	},
};
