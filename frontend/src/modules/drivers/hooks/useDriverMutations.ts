import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantQueryKey } from '@utils/query-keys';
import type { DispatchStatus, DriverValues } from '../api';
import { sampleDriversApi } from '../data/sampleDrivers';

// Onboarding and editing drivers, changing their duty status, and linking their login account. Each change
// refreshes every driver answer, so the list and the details never show stale data.
export function useDriverMutations() {
	const queryClient = useQueryClient();
	const refreshDrivers = () =>
		queryClient.invalidateQueries({ queryKey: tenantQueryKey('drivers') });

	// POST /api/drivers
	const create = useMutation({
		mutationFn: (values: DriverValues) => sampleDriversApi.create(values),
		onSuccess: refreshDrivers,
	});
	// PATCH /api/drivers/:id
	const update = useMutation({
		mutationFn: ({ driverId, values }: { driverId: string; values: DriverValues }) =>
			sampleDriversApi.update(driverId, values),
		onSuccess: refreshDrivers,
	});
	// PATCH /api/drivers/:id/duty-status
	const setDispatchStatus = useMutation({
		mutationFn: ({ driverId, status }: { driverId: string; status: DispatchStatus }) =>
			sampleDriversApi.setDispatchStatus(driverId, status),
		onSettled: refreshDrivers,
	});
	// PUT /api/drivers/:id/account
	const linkAccount = useMutation({
		mutationFn: ({ driverId, userId }: { driverId: string; userId: string | null }) =>
			sampleDriversApi.linkAccount(driverId, userId),
		// Also after a refusal: someone may have linked that account to another driver first.
		onSettled: refreshDrivers,
	});

	return {
		createDriver: create.mutate,
		isCreating: create.isPending,
		createError: create.error,
		updateDriver: update.mutate,
		isUpdating: update.isPending,
		updateError: update.error,
		setDriverDispatchStatus: setDispatchStatus.mutate,
		isSettingStatus: setDispatchStatus.isPending,
		setStatusError: setDispatchStatus.error,
		linkDriverAccount: linkAccount.mutate,
		isLinking: linkAccount.isPending,
		linkError: linkAccount.error,
	};
}
