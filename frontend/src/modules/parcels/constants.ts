import type { DispatchDriver, FailureReason, ParcelStatus, ParcelVehicle } from './api';

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

export const failureReasonLabels: Record<FailureReason, string> = {
	recipient_unavailable: 'Recipient unavailable',
	address_not_found: 'Address not found',
	refused: 'Refused by recipient',
	cod_not_ready: 'COD not ready',
};

export const failureReasons = (Object.keys(failureReasonLabels) as FailureReason[]).map(
	(value) => ({ value, label: failureReasonLabels[value] }),
);

export const dispatchStatusLabels: Record<DispatchDriver['dispatchStatus'], string> = {
	available: 'Available',
	on_pickup: 'On pickup',
	out_for_delivery: 'Out for delivery',
};

// Only sorted parcels and failed attempts can be (re)assigned.
export const ASSIGNABLE_STATUSES: readonly ParcelStatus[] = ['in_hub_sorted', 'failed_attempt'];

// "Van V-012 · PL-1234", or the driver's own vehicle when they have none checked out.
export const vehicleLabel = (vehicle: ParcelVehicle | null) =>
	vehicle
		? [`${vehicle.name} ${vehicle.tag}`, vehicle.licensePlate].filter(Boolean).join(' · ')
		: 'No vehicle checked out';
