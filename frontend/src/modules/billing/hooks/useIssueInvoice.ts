import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantQueryKey } from '@utils/query-keys';
import { apiRequest } from '@services/api-client';
import type { Invoice } from '../api';

// Issuing a draft invoice. The invoice and the list are refreshed also after a refusal: "not a draft" means someone
// else issued it first, and the dialog should show what it is now.
export function useIssueInvoice(invoiceId: string) {
	const queryClient = useQueryClient();
	// POST /api/billing/invoices/:id/issue
	const issue = useMutation({
		// A company switch while POST is in flight must not redirect its cache refresh.
		onMutate: () => ({ clientsKey: tenantQueryKey('clients') }),
		mutationFn: () =>
			apiRequest<Invoice>(`billing/invoices/${encodeURIComponent(invoiceId)}/issue`, {
				method: 'POST',
			}),
		onSettled: (_data, _error, _vars, context) =>
			context && queryClient.invalidateQueries({ queryKey: context.clientsKey }),
	});

	return {
		issueInvoice: issue.mutate,
		isIssuing: issue.isPending,
		issueError: issue.error,
	};
}
