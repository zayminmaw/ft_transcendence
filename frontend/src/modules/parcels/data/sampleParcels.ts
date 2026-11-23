import type { ParcelStatus } from '../api';

// Sample data for the public tracking page until the tracking endpoint exists: only what that page shows (the status
// and its times), never the recipient, the address, COD or who handled the parcel.
export type TrackedParcel = {
	tracking: string;
	status: ParcelStatus;
	// Times are local ISO dates, formatted for the reader's language.
	events: { status: ParcelStatus; time: string }[];
};

export const parcels: TrackedParcel[] = [
	{
		tracking: 'TRC-10474',
		status: 'out_for_delivery',
		events: [
			{ status: 'pickup_scheduled', time: '2026-10-12T16:10:00' },
			{ status: 'picked_up', time: '2026-10-13T08:05:00' },
			{ status: 'in_hub_sorted', time: '2026-10-13T08:50:00' },
			{ status: 'out_for_delivery', time: '2026-10-13T12:20:00' },
		],
	},
	{
		tracking: 'TRC-10472',
		status: 'delivered',
		events: [
			{ status: 'in_hub_sorted', time: '2026-10-13T07:55:00' },
			{ status: 'out_for_delivery', time: '2026-10-13T08:40:00' },
			{ status: 'delivered', time: '2026-10-13T10:05:00' },
		],
	},
];
