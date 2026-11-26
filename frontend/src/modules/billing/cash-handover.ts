import type { WaitingParcel } from './api';

// ReconcileCodDto accepts no more than 200 parcel IDs per handover.
export const MAX_HANDOVER_PARCELS = 200;

export function handoverTotal(parcels: WaitingParcel[]): string {
	const cents = parcels.reduce((sum, parcel) => {
		const [whole, fraction] = parcel.codAmount.split('.');
		return sum + BigInt(whole) * 100n + BigInt(fraction);
	}, 0n);
	return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
