import { useQuery } from '@tanstack/react-query';
import { tenantQueryKey } from '@utils/query-keys';
import { apiRequest } from '@services/api-client';
import type { Invoice } from '../api';

// One invoice with its parcel lines, read when its dialog opens. Under 'clients' like the list, so it follows a payout.
export function useInvoice(invoiceId: string) {
	const query = useQuery({
		queryKey: tenantQueryKey('clients', 'invoice', invoiceId),
		queryFn: () => apiRequest<Invoice>(`billing/invoices/${encodeURIComponent(invoiceId)}`),
	});
	return {
		invoice: query.data,
		isPending: query.isPending,
		invoiceError: query.error,
		isFetching: query.isFetching,
		retryInvoice: query.refetch,
	};
}
