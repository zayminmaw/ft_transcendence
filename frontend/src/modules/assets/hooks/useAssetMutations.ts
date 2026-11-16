import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantQueryKey } from '@utils/query-keys';
import { apiRequest } from '@services/api-client';
import {
	assetPath,
	type AssetDetails,
	type AssetValues,
	type CheckInValues,
	type CheckOutValues,
	type MaintenanceValues,
} from '../api';

// Sends the values to the API and answers with the saved asset.
const send = (path: string, values: object, method = 'POST') =>
	apiRequest<AssetDetails>(path, { method, body: JSON.stringify(values) });

// Adding and editing assets, checking them out and in, and logging services. Each change refreshes every asset
// answer, so the list and the details never show stale data.
export function useAssetMutations() {
	const queryClient = useQueryClient();
	const refreshAssets = () =>
		queryClient.invalidateQueries({ queryKey: tenantQueryKey('assets') });

	// POST /api/assets
	const create = useMutation({
		mutationFn: (values: AssetValues) => send('assets', values),
		onSuccess: refreshAssets,
	});
	// PATCH /api/assets/:id
	const update = useMutation({
		mutationFn: ({ assetId, values }: { assetId: string; values: AssetValues }) =>
			send(assetPath(assetId), values, 'PATCH'),
		onSuccess: refreshAssets,
	});
	// POST /api/assets/:id/check-out
	const checkOut = useMutation({
		mutationFn: ({ assetId, values }: { assetId: string; values: CheckOutValues }) =>
			send(assetPath(assetId, '/check-out'), values),
		// Also after a refusal: someone may have checked it out first.
		onSettled: refreshAssets,
	});
	// POST /api/assets/:id/check-in
	const checkIn = useMutation({
		mutationFn: ({ assetId, values }: { assetId: string; values: CheckInValues }) =>
			send(assetPath(assetId, '/check-in'), values),
		onSettled: refreshAssets,
	});
	// POST /api/assets/:id/maintenance
	const logMaintenance = useMutation({
		mutationFn: ({ assetId, values }: { assetId: string; values: MaintenanceValues }) =>
			send(assetPath(assetId, '/maintenance'), values),
		onSuccess: refreshAssets,
	});

	return {
		createAsset: create.mutate,
		isCreating: create.isPending,
		createError: create.error,
		updateAsset: update.mutate,
		isUpdating: update.isPending,
		updateError: update.error,
		checkOutAsset: checkOut.mutate,
		isCheckingOut: checkOut.isPending,
		checkOutError: checkOut.error,
		checkInAsset: checkIn.mutate,
		isCheckingIn: checkIn.isPending,
		checkInError: checkIn.error,
		logAssetMaintenance: logMaintenance.mutate,
		isLogging: logMaintenance.isPending,
		logError: logMaintenance.error,
	};
}
