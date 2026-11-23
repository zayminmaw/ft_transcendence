import type { TFunction } from 'i18next';
import type { FailureReason, ParcelStatus, ParcelVehicle } from './api';

// Every status in lifecycle order; its label is parcels:status.<status>.
export const PARCEL_STATUSES: readonly ParcelStatus[] = [
	'draft',
	'pickup_scheduled',
	'picked_up',
	'in_hub_sorted',
	'out_for_delivery',
	'delivered',
	'failed_attempt',
	'returned_to_sender',
];

export const FAILURE_REASONS: readonly FailureReason[] = [
	'recipient_unavailable',
	'address_not_found',
	'refused',
	'cod_not_ready',
];

// Only sorted parcels and failed attempts can be (re)assigned.
export const ASSIGNABLE_STATUSES: readonly ParcelStatus[] = ['in_hub_sorted', 'failed_attempt'];

// "Van V-012 · PL-1234", or the driver's own vehicle when they have none checked out.
export const vehicleLabel = (t: TFunction<'parcels'>, vehicle: ParcelVehicle | null) =>
	vehicle
		? [`${vehicle.name} ${vehicle.tag}`, vehicle.licensePlate].filter(Boolean).join(' · ')
		: t('common.noVehicle');
