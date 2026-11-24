import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast } from '@global-components';
import { tenantQueryKey } from '@utils/query-keys';
import { apiRequest } from '@services/api-client';
import type { Handover, HandoverValues, WaitingCash } from '../api';

// What one driver still owes the cashier: their delivered parcels no handover has claimed.
export function useWaitingCash(driverId: string) {
	const { t } = useTranslation('billing');
	const { toast } = useToast();
	const query = useQuery({
		queryKey: tenantQueryKey('billing', 'waiting-cash', driverId),
		queryFn: () =>
			apiRequest<WaitingCash>(
				`billing/reconcile-cod/driver/${encodeURIComponent(driverId)}/unreconciled-parcels`,
			),
		enabled: driverId !== '',
	});
	// One toast per failed load: errorUpdatedAt changes only when a new failure arrives.
	const { error, errorUpdatedAt } = query;
	useEffect(() => {
		if (error)
			toast({
				variant: 'error',
				title: t('cashHandover.loadFailed'),
				description: error.message,
			});
	}, [error, errorUpdatedAt, toast, t]);
	return { waiting: query.data, isWaitingPending: query.isFetching && !query.data };
}

// Recording the handover. Merchant balances and the waiting list changed, so both are refreshed, also after a
// refusal: the parcels may have been taken by another handover in the meantime.
export function useCashHandover() {
	const queryClient = useQueryClient();
	// POST /api/billing/reconcile-cod
	const handover = useMutation({
		mutationFn: (values: HandoverValues) =>
			apiRequest<Handover>('billing/reconcile-cod', {
				method: 'POST',
				body: JSON.stringify(values),
			}),
		onSettled: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: tenantQueryKey('billing') }),
				queryClient.invalidateQueries({ queryKey: tenantQueryKey('clients') }),
			]),
	});
	return {
		recordHandover: handover.mutate,
		isRecording: handover.isPending,
		handoverError: handover.error,
		resetHandover: handover.reset,
	};
}
