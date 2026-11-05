// /api/parcels: the waybills of the open company, from pickup to dispatch. These are the shapes it answers with.
// Money and weight stay strings like the DECIMAL columns; times are ISO strings.

// The API path of one parcel, or of something under it (e.g. '/status').
export const parcelPath = (parcelId: string, rest = '') =>
	`parcels/${encodeURIComponent(parcelId)}${rest}`;

// `parcels.lifecycle_status`.
export type ParcelStatus =
	| 'draft'
	| 'pickup_scheduled'
	| 'picked_up'
	| 'in_hub_sorted'
	| 'out_for_delivery'
	| 'delivered'
	| 'failed_attempt'
	| 'returned_to_sender';

// Stored in `parcels.failed_reason_code`.
export type FailureReason =
	'recipient_unavailable' | 'address_not_found' | 'refused' | 'cod_not_ready';

// The list's queues, or one status.
export type ParcelQueue = 'all' | 'ready' | 'exceptions' | 'assignable' | ParcelStatus;

export type ParcelSortKey = 'createdAt' | 'tracking' | 'merchant';

export type ParcelListParams = {
	search: string;
	queue: ParcelQueue;
	sort: ParcelSortKey;
	direction: 'asc' | 'desc';
	page: number;
	pageSize: number;
};

export type ParcelClient = { id: string; code: string; name: string };
export type ParcelDriver = { id: string; name: string; employeeCode: string };
export type ParcelVehicle = { id: string; tag: string; name: string; licensePlate: string | null };
// RUN-<yyyymmdd>-<id>: one driver's parcels for one day.
export type ParcelRun = { id: string; code: string };

export type Parcel = {
	id: string;
	trackingNumber: string;
	status: ParcelStatus;
	client: ParcelClient;
	driver: ParcelDriver | null;
	vehicle: ParcelVehicle | null;
	run: ParcelRun | null;
	recipientName: string;
	recipientPhone: string;
	recipientSecondaryPhone: string | null;
	deliveryAddress: string;
	deliveryCityZone: string;
	deliveryLandmark: string | null;
	weightKg: string;
	isFragile: boolean;
	deliveryFee: string;
	codAmount: string;
	deliveryAttemptCount: number;
	failedReasonCode: FailureReason | null;
	createdAt: string;
	updatedAt: string;
};

// One step of the history, oldest first. An assignment names the driver, vehicle and run it went out with; a failed
// attempt names its reason and the driver it failed with.
export type ParcelEvent = {
	id: string;
	status: ParcelStatus;
	at: string;
	actor: { userId: string; name: string } | null;
	hubLocation: string | null;
	driver: ParcelDriver | null;
	vehicle: ParcelVehicle | null;
	run: ParcelRun | null;
	reasonCode: FailureReason | null;
	notes: string | null;
};

export type ParcelDetails = Parcel & { events: ParcelEvent[] };

export type ParcelList = {
	items: Parcel[];
	total: number;
	page: number;
	pageSize: number;
	// Over the whole company, whatever the search and filter.
	counts: { statuses: Record<ParcelStatus, number>; driversOut: number };
};

// A driver on duty, with the vehicle they have checked out and today's run if it is open.
export type DispatchDriver = ParcelDriver & {
	zone: string | null;
	dispatchStatus: 'available' | 'on_pickup' | 'out_for_delivery';
	vehicle: ParcelVehicle | null;
	run: (ParcelRun & { parcelsOut: number }) | null;
};

// GET /api/parcels/form-options: the active merchants and the zones already in use.
export type ParcelFormOptions = { clients: ParcelClient[]; zones: string[] };

// POST /api/parcels
export type NewParcelValues = {
	clientId: string;
	recipientName: string;
	recipientPhone: string;
	recipientSecondaryPhone: string | null;
	deliveryAddress: string;
	deliveryCityZone: string;
	deliveryLandmark: string | null;
	weightKg: string;
	isFragile: boolean;
	deliveryFee: string;
	codAmount: string;
	notes: string | null;
};

// POST /api/parcels/:id/status: one step forward. Out for delivery comes from an assignment; delivered from proof
// of delivery.
export type StatusMove =
	| { status: 'picked_up'; notes?: string }
	| { status: 'in_hub_sorted'; hubLocation: string; notes?: string }
	| { status: 'failed_attempt'; reasonCode: FailureReason; notes?: string }
	| { status: 'returned_to_sender'; notes: string };
