import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantQueryKey } from '@utils/query-keys';
import { apiRequest } from '@services/api-client';
import {
	parcelPath,
	type NewParcelValues,
	type Parcel,
	type ParcelDetails,
	type StatusMove,
} from '../api';

// Creating waybills, moving them through pickup, hub and failure, and sending them out with a driver. Each change
// refreshes every parcel answer, also after a refusal: the parcel may have moved on in the meantime. Nobody waits for
// that refresh (the page usually moves on), and it joins the one the change's live update may have started already.
export function useParcelMutations() {
	const queryClient = useQueryClient();
	const refreshParcels = () => {
		void queryClient.invalidateQueries(
			{ queryKey: tenantQueryKey('parcels') },
			{ cancelRefetch: false },
		);
	};
	// The changed parcel shows at once on its details page; its history follows with the refresh.
	const showSaved = (parcel: Parcel) =>
		queryClient.setQueryData<ParcelDetails>(
			tenantQueryKey('parcels', 'details', parcel.id),
			(details) => details && { ...details, ...parcel },
		);

	// POST /api/parcels
	const create = useMutation({
		mutationFn: (values: NewParcelValues) =>
			apiRequest<Parcel>('parcels', { method: 'POST', body: JSON.stringify(values) }),
		onSuccess: refreshParcels,
	});
	// POST /api/parcels/:id/status
	const move = useMutation({
		mutationFn: ({ parcelId, move }: { parcelId: string; move: StatusMove }) =>
			apiRequest<Parcel>(parcelPath(parcelId, '/status'), {
				method: 'POST',
				body: JSON.stringify(move),
			}),
		onSuccess: showSaved,
		onSettled: refreshParcels,
	});
	// POST /api/parcels/:id/assignment
	const assign = useMutation({
		mutationFn: ({
			parcelId,
			driverId,
			notes,
		}: {
			parcelId: string;
			driverId: string;
			notes: string | null;
		}) =>
			apiRequest<Parcel>(parcelPath(parcelId, '/assignment'), {
				method: 'POST',
				body: JSON.stringify({ driverId, notes }),
			}),
		onSuccess: showSaved,
		onSettled: refreshParcels,
	});

	return {
		createParcel: create.mutate,
		isCreating: create.isPending,
		moveParcel: move.mutate,
		isMoving: move.isPending,
		moveError: move.error,
		assignParcel: assign.mutate,
		isAssigning: assign.isPending,
	};
}
