import { apiRequest } from '@services/api-client';

export type DashboardParcelStatus =
	| 'draft'
	| 'pickup_scheduled'
	| 'picked_up'
	| 'in_hub_sorted'
	| 'out_for_delivery'
	| 'delivered'
	| 'failed_attempt'
	| 'returned_to_sender';

export type DashboardParcel = {
	id: string;
	trackingNumber: string;
	status: DashboardParcelStatus;
	client: { id: string; code: string; name: string };
	driver: { id: string; name: string; employeeCode: string } | null;
	recipientName: string;
	deliveryCityZone: string;
	codAmount: string;
	deliveryFee: string;
	createdAt: string;
};

export type DashboardParcelList = {
	items: DashboardParcel[];
	total: number;
	counts: { statuses: Record<DashboardParcelStatus, number>; driversOut: number };
};

export type DashboardDispatchDriver = {
	id: string;
	employeeCode: string;
	name: string;
	dispatchStatus: 'available' | 'on_pickup' | 'out_for_delivery';
	assignedZone: string | null;
	vehicle: { id: string; tag: string; name: string; licensePlate: string | null } | null;
	todayParcelCount: number;
};

export type DashboardClient = {
	id: string;
	clientCode: string;
	businessName: string;
	contactPersonName: string;
	currentBalance?: string;
	pendingCodBalance?: string;
	rateProfileTier?: string;
	isActive: boolean;
};

export type DashboardClientList = {
	items: DashboardClient[];
	total: number;
	counts: { total: number; active: number; archived: number; pinned: number };
};

export type DashboardDriver = {
	id: string;
	employeeCode: string;
	firstName: string;
	lastName: string;
	assignedZone: string | null;
	dispatchStatus: 'off_duty' | 'available' | 'on_pickup' | 'out_for_delivery' | 'suspended';
	employmentStatus: 'active' | 'on_leave' | 'probation' | 'terminated';
	account: { userId: string; username: string } | null;
	licenseExpiryDate?: string;
};

export type DashboardDriverList = {
	items: DashboardDriver[];
	total: number;
	counts: {
		total: number;
		available: number;
		onRun: number;
		offDuty: number;
		suspended: number;
		licensesExpiring: number;
	};
};

export type DashboardAsset = {
	id: string;
	assetTag: string;
	assetName: string;
	category: 'motorcycle' | 'van' | 'thermal_bag' | 'barcode_scanner' | 'mobile_pos' | 'other';
	licensePlate: string | null;
	currentCondition: 'new' | 'good' | 'needs_maintenance' | 'decommissioned';
	holder: { driverId: string; driverName: string } | null;
	roadTaxExpiry: string | null;
	nextServiceDue: string | null;
};

export type DashboardAssetList = {
	items: DashboardAsset[];
	total: number;
	counts: {
		inService: number;
		checkedOut: number;
		needsMaintenance: number;
		decommissioned: number;
		roadTaxDue: number;
	};
};

export type DashboardCashDriver = {
	id: string;
	name: string;
	employeeCode: string;
};

export type DashboardMember = {
	userId: string;
	username: string;
	displayName: string | null;
	role: { code: string; name: string };
	isActive: boolean;
	lastLoginAt: string | null;
	mustChangePassword: boolean;
};

export type DashboardInvite = {
	id: string;
	email: string | null;
	role: { code: string; name: string };
	status: 'pending' | 'used' | 'expired' | 'revoked';
	expiresAt: string;
};

export type DashboardInsights = {
	range: number;
	hasHistory: boolean;
	members: { active: number; total: number };
	visits: number;
	activeByDay: { day: string; members: number }[];
	changes: { total: number; byModule: { module: string; count: number }[] };
	security: {
		passwordResets: number;
		accountsSwitchedOff: number;
		roleChanges: number;
		deniedAttempts: number;
	};
};

export type DashboardContact = {
	userId: string;
	username: string;
	displayName: string | null;
	role: { code: string; name: string };
	status: 'online' | 'offline' | 'suspended';
};

export function fetchDashboardParcels() {
	return apiRequest<DashboardParcelList>(
		'parcels?queue=all&sort=createdAt&direction=desc&page=1&pageSize=10',
	);
}

export function fetchDashboardDispatchDrivers() {
	return apiRequest<DashboardDispatchDriver[]>('parcels/dispatch-drivers');
}

export function fetchDashboardClients() {
	return apiRequest<DashboardClientList>(
		'clients?status=active&sort=createdAt&direction=desc&page=1&pageSize=10',
	);
}

export function fetchDashboardDrivers() {
	return apiRequest<DashboardDriverList>(
		'drivers?status=all&sort=lastName&direction=asc&page=1&pageSize=10',
	);
}

export function fetchDashboardAssets() {
	return apiRequest<DashboardAssetList>(
		'assets?status=all&sort=assetTag&direction=asc&page=1&pageSize=10',
	);
}

export function fetchDashboardCashDrivers() {
	return apiRequest<DashboardCashDriver[]>('billing/reconcile-cod/drivers');
}

export function fetchDashboardMembers() {
	return apiRequest<DashboardMember[]>('members');
}

export function fetchDashboardInvites() {
	return apiRequest<DashboardInvite[]>('members/invites');
}

export function fetchDashboardInsights() {
	return apiRequest<DashboardInsights>('activity-insights?range=30');
}

export function fetchDashboardContacts() {
	return apiRequest<DashboardContact[]>('contacts');
}
