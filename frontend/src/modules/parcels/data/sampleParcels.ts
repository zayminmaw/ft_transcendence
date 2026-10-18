// Sample data until the parcel and driver endpoints exist. Statuses mirror `parcels.lifecycle_status`
// and `delivery_drivers.dispatch_status`; money stays a string like the DECIMAL columns.
export type ParcelStatus =
	| 'draft'
	| 'pickup_scheduled'
	| 'picked_up'
	| 'in_hub_sorted'
	| 'out_for_delivery'
	| 'delivered'
	| 'failed_attempt'
	| 'returned_to_sender';

export const parcelStatusLabels: Record<ParcelStatus, string> = {
	draft: 'Draft',
	pickup_scheduled: 'Pickup scheduled',
	picked_up: 'Picked up',
	in_hub_sorted: 'In hub / sorted',
	out_for_delivery: 'Out for delivery',
	delivered: 'Delivered · POD',
	failed_attempt: 'Failed attempt',
	returned_to_sender: 'Returned to sender',
};

export type ParcelEvent = {
	status: ParcelStatus;
	time: string;
	actor: string;
	notes?: string;
};

export type Parcel = {
	id: string;
	tracking: string;
	recipient: string;
	recipientPhone: string;
	address: string;
	zone: string;
	merchant: string;
	driverId?: string;
	status: ParcelStatus;
	weightKg: string;
	fragile: boolean;
	codAmount: string;
	deliveryFee: string;
	attempts: number;
	failedReason?: string;
	events: ParcelEvent[];
};

export type Driver = {
	id: string;
	name: string;
	initials: string;
	vehicle: string;
	zone: string;
	status: 'available' | 'out_for_delivery';
};

export const drivers: Driver[] = [
	{
		id: 'd1',
		name: 'Leen Mansour',
		initials: 'LM',
		vehicle: 'Van V-012',
		zone: 'East',
		status: 'available',
	},
	{
		id: 'd2',
		name: 'Samir Farah',
		initials: 'SF',
		vehicle: 'Motorcycle M-04',
		zone: 'Central',
		status: 'available',
	},
	{
		id: 'd3',
		name: 'Hadi Salim',
		initials: 'HS',
		vehicle: 'Van V-008',
		zone: 'West',
		status: 'out_for_delivery',
	},
];

export const driverStatusLabels: Record<Driver['status'], string> = {
	available: 'Available',
	out_for_delivery: 'Out for delivery',
};

export const parcels: Parcel[] = [
	{
		id: '10476',
		tracking: 'TRC-10476',
		recipient: 'Maya N.',
		recipientPhone: '+962 7 9555 0101',
		address: '22 Rainbow Street, Amman',
		zone: 'Central',
		merchant: 'Paper & Co.',
		status: 'in_hub_sorted',
		weightKg: '1.20',
		fragile: false,
		codAmount: '120.00',
		deliveryFee: '7.00',
		attempts: 0,
		events: [
			{ status: 'pickup_scheduled', time: '12 Oct 2026, 16:10', actor: 'Rami Saleh' },
			{ status: 'picked_up', time: '13 Oct 2026, 09:05', actor: 'Leen Mansour' },
			{
				status: 'in_hub_sorted',
				time: '13 Oct 2026, 11:40',
				actor: 'Samer Kassab',
				notes: 'Central hub · Bay 3',
			},
		],
	},
	{
		id: '10475',
		tracking: 'TRC-10475',
		recipient: 'Adam S.',
		recipientPhone: '+962 7 9555 0102',
		address: '8 Wasfi Al-Tal Street, Amman',
		zone: 'West',
		merchant: 'Field Goods',
		status: 'in_hub_sorted',
		weightKg: '3.50',
		fragile: true,
		codAmount: '45.50',
		deliveryFee: '9.00',
		attempts: 0,
		events: [
			{ status: 'picked_up', time: '13 Oct 2026, 08:30', actor: 'Hadi Salim' },
			{
				status: 'in_hub_sorted',
				time: '13 Oct 2026, 10:15',
				actor: 'Samer Kassab',
				notes: 'Central hub · Bay 1',
			},
		],
	},
	{
		id: '10474',
		tracking: 'TRC-10474',
		recipient: 'Rana K.',
		recipientPhone: '+962 7 9555 0103',
		address: '41 Al-Jubeiha Road, Amman',
		zone: 'East',
		merchant: 'North Store',
		driverId: 'd1',
		status: 'out_for_delivery',
		weightKg: '0.80',
		fragile: false,
		codAmount: '60.00',
		deliveryFee: '7.00',
		attempts: 0,
		events: [
			{ status: 'in_hub_sorted', time: '13 Oct 2026, 08:50', actor: 'Samer Kassab' },
			{
				status: 'out_for_delivery',
				time: '13 Oct 2026, 12:20',
				actor: 'Rami Saleh',
				notes: 'Assigned to Leen Mansour · Van V-012',
			},
		],
	},
	{
		id: '10473',
		tracking: 'TRC-10473',
		recipient: 'Yara A.',
		recipientPhone: '+962 7 9555 0104',
		address: '5 Mecca Street, Amman',
		zone: 'Central',
		merchant: 'Studio Supply',
		driverId: 'd2',
		status: 'failed_attempt',
		weightKg: '2.10',
		fragile: false,
		codAmount: '210.00',
		deliveryFee: '7.00',
		attempts: 1,
		failedReason: 'Recipient unavailable',
		events: [
			{ status: 'in_hub_sorted', time: '12 Oct 2026, 15:00', actor: 'Samer Kassab' },
			{
				status: 'out_for_delivery',
				time: '13 Oct 2026, 09:40',
				actor: 'Rami Saleh',
				notes: 'Assigned to Samir Farah · Motorcycle M-04',
			},
			{
				status: 'failed_attempt',
				time: '13 Oct 2026, 13:25',
				actor: 'Samir Farah',
				notes: 'Recipient unavailable · No answer on two calls',
			},
		],
	},
	{
		id: '10472',
		tracking: 'TRC-10472',
		recipient: 'Ziad H.',
		recipientPhone: '+962 7 9555 0105',
		address: '17 Zahran Street, Amman',
		zone: 'West',
		merchant: 'Paper & Co.',
		driverId: 'd3',
		status: 'delivered',
		weightKg: '0.60',
		fragile: false,
		codAmount: '35.00',
		deliveryFee: '7.00',
		attempts: 0,
		events: [
			{ status: 'in_hub_sorted', time: '13 Oct 2026, 07:55', actor: 'Samer Kassab' },
			{
				status: 'out_for_delivery',
				time: '13 Oct 2026, 08:40',
				actor: 'Rami Saleh',
				notes: 'Assigned to Hadi Salim · Van V-008',
			},
			{
				status: 'delivered',
				time: '13 Oct 2026, 10:05',
				actor: 'Hadi Salim',
				notes: 'Signature and doorstep photo captured',
			},
		],
	},
	{
		id: '10471',
		tracking: 'TRC-10471',
		recipient: 'Lina O.',
		recipientPhone: '+962 7 9555 0106',
		address: '3 Abdoun Circle, Amman',
		zone: 'East',
		merchant: 'North Store',
		driverId: 'd1',
		status: 'returned_to_sender',
		weightKg: '1.75',
		fragile: false,
		codAmount: '80.00',
		deliveryFee: '7.00',
		attempts: 3,
		failedReason: 'Address not found',
		events: [
			{
				status: 'failed_attempt',
				time: '10 Oct 2026, 14:10',
				actor: 'Leen Mansour',
				notes: 'Address not found',
			},
			{
				status: 'failed_attempt',
				time: '12 Oct 2026, 11:30',
				actor: 'Leen Mansour',
				notes: 'Address not found · Third attempt',
			},
			{
				status: 'returned_to_sender',
				time: '13 Oct 2026, 09:00',
				actor: 'Rami Saleh',
				notes: 'Return charge posted to merchant',
			},
		],
	},
];

export const findDriver = (id?: string) => drivers.find((driver) => driver.id === id);
