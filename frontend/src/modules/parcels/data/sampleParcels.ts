import type { ParcelStatus } from '../api';

// Sample data for the public tracking page until the tracking endpoint exists: only what that page shows (the status
// and its times), never the recipient, the address, COD or who handled the parcel.
export type TrackedParcel = {
	tracking: string;
	status: ParcelStatus;
	events: { status: ParcelStatus; time: string }[];
};

export const parcels: TrackedParcel[] = [
	{
		tracking: 'TRC-10474',
		status: 'out_for_delivery',
		events: [
			{ status: 'pickup_scheduled', time: '12 Oct 2026, 16:10' },
			{ status: 'picked_up', time: '13 Oct 2026, 08:05' },
			{ status: 'in_hub_sorted', time: '13 Oct 2026, 08:50' },
			{ status: 'out_for_delivery', time: '13 Oct 2026, 12:20' },
		],
	},
	{
		tracking: 'TRC-10472',
		status: 'delivered',
		events: [
			{ status: 'in_hub_sorted', time: '13 Oct 2026, 07:55' },
			{ status: 'out_for_delivery', time: '13 Oct 2026, 08:40' },
			{ status: 'delivered', time: '13 Oct 2026, 10:05' },
		],
	},
];
