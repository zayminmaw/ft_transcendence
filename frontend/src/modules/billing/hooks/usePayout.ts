import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantQueryKey } from '@utils/query-keys';
import { apiRequest } from '@services/api-client';
import type { Payout, PayoutValues } from '../api';

// Paying a merchant out. The balance changed, so every client answer is refreshed, also after a refusal: the balance
// may have moved on in the meantime.
export function usePayout() {
	const queryClient = useQueryClient();
	// POST /api/billing/payouts
	const payout = useMutation({
		mutationFn: (values: PayoutValues) =>
			apiRequest<Payout>('billing/payouts', { method: 'POST', body: JSON.stringify(values) }),
		onSettled: () => queryClient.invalidateQueries({ queryKey: tenantQueryKey('clients') }),
	});

	return {
		payMerchant: payout.mutate,
		isPaying: payout.isPending,
		payError: payout.error,
		resetPay: payout.reset,
	};
}
