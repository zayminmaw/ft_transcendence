import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast } from '@global-components';
import { tenantQueryKey } from '@utils/query-keys';
import { apiRequest } from '@services/api-client';
import type { InvoicePage } from '../api';

// One merchant's invoices, newest first. The previous page stays on screen while the next one loads, and a new page
// size goes back to page 1. It sits under 'clients', so a payout that refreshes the client answers (and marks invoices
// paid) refreshes the list too.
export function useMerchantInvoices(clientId: string) {
	const { t } = useTranslation('billing');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSizeValue] = useState(10);
	const merchantKey = tenantQueryKey('clients', 'invoices', clientId);
	const query = useQuery({
		queryKey: [...merchantKey, { page, pageSize }],
		queryFn: () =>
			apiRequest<InvoicePage>(
				`billing/invoices?${new URLSearchParams({
					clientId,
					page: String(page),
					pageSize: String(pageSize),
				})}`,
			),
		placeholderData: (previous, previousQuery) =>
			merchantKey.every((part, index) => previousQuery?.queryKey[index] === part)
				? previous
				: undefined,
	});

	// One toast per failed load: errorUpdatedAt changes only when a new failure arrives.
	const { toast } = useToast();
	const { error, errorUpdatedAt } = query;
	useEffect(() => {
		if (error)
			toast({
				variant: 'error',
				title: t('invoices.loadFailed'),
				description: error.message,
			});
	}, [error, errorUpdatedAt, toast, t]);

	return {
		invoices: query.data?.items ?? [],
		total: query.data?.total ?? 0,
		isPending: query.isPending,
		invoicesError: error,
		isFetching: query.isFetching,
		retryInvoices: query.refetch,
		page,
		setPage,
		pageSize,
		setPageSize: (value: number) => {
			setPageSizeValue(value);
			setPage(1);
		},
	};
}
