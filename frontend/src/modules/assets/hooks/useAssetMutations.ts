import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantQueryKey } from '@utils/query-keys';
import type { AssetValues, CheckInValues, CheckOutValues, MaintenanceValues } from '../api';
import { sampleAssetsApi } from '../data/sampleAssets';

// Adding and editing assets, checking them out and in, and logging services. Each change refreshes every asset
// answer, so the list and the details never show stale data.
export function useAssetMutations() {
	const queryClient = useQueryClient();
	const refreshAssets = () =>
		queryClient.invalidateQueries({ queryKey: tenantQueryKey('assets') });

	// POST /api/assets
	const create = useMutation({
		mutationFn: (values: AssetValues) => sampleAssetsApi.create(values),
		onSuccess: refreshAssets,
	});
	// PATCH /api/assets/:id
	const update = useMutation({
		mutationFn: ({ assetId, values }: { assetId: string; values: AssetValues }) =>
			sampleAssetsApi.update(assetId, values),
		onSuccess: refreshAssets,
	});
	// POST /api/assets/:id/check-out. driverName is only for the sample data; the API looks it up.
	const checkOut = useMutation({
		mutationFn: ({
			assetId,
			values,
			driverName,
		}: {
			assetId: string;
			values: CheckOutValues;
			driverName: string;
		}) => sampleAssetsApi.checkOut(assetId, values, driverName),
		// Also after a refusal: someone may have checked it out first.
		onSettled: refreshAssets,
	});
	// POST /api/assets/:id/check-in
	const checkIn = useMutation({
		mutationFn: ({ assetId, values }: { assetId: string; values: CheckInValues }) =>
			sampleAssetsApi.checkIn(assetId, values),
		onSettled: refreshAssets,
	});
	// POST /api/assets/:id/maintenance
	const logMaintenance = useMutation({
		mutationFn: ({ assetId, values }: { assetId: string; values: MaintenanceValues }) =>
			sampleAssetsApi.logMaintenance(assetId, values),
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
