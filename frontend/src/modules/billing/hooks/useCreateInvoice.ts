import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantQueryKey } from '@utils/query-keys';
import { apiRequest } from '@services/api-client';
import type { Invoice, InvoiceValues } from '../api';

// Billing a merchant for a period. The list is refreshed also after a refusal: "nothing left to bill" can mean a draft
// for that period was created by a request whose answer never arrived, and it should show in the list.
export function useCreateInvoice() {
	const queryClient = useQueryClient();
	// POST /api/billing/invoices
	const create = useMutation({
		mutationFn: (values: InvoiceValues) =>
			apiRequest<Invoice>('billing/invoices', {
				method: 'POST',
				body: JSON.stringify(values),
			}),
		onSettled: () => queryClient.invalidateQueries({ queryKey: tenantQueryKey('clients') }),
	});

	return {
		createInvoice: create.mutate,
		isCreating: create.isPending,
		createError: create.error,
		resetCreate: create.reset,
	};
}
