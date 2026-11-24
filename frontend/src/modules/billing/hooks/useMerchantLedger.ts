import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast } from '@global-components';
import { tenantQueryKey } from '@utils/query-keys';
import { apiRequest } from '@services/api-client';
import type { LedgerPage } from '../api';

// One merchant's ledger, newest line first. The previous page stays on screen while the next one loads, and a new
// page size goes back to page 1. It sits under 'clients', so a payout or any other change that refreshes the client
// answers refreshes the ledger too.
export function useMerchantLedger(clientId: string) {
	const { t } = useTranslation('billing');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSizeValue] = useState(10);
	const merchantKey = tenantQueryKey('clients', 'ledger', clientId);
	const query = useQuery({
		queryKey: [...merchantKey, { page, pageSize }],
		queryFn: () =>
			apiRequest<LedgerPage>(
				`billing/clients/${encodeURIComponent(clientId)}/ledger?${new URLSearchParams({
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
			toast({ variant: 'error', title: t('ledger.loadFailed'), description: error.message });
	}, [error, errorUpdatedAt, toast, t]);

	return {
		entries: query.data?.items ?? [],
		total: query.data?.total ?? 0,
		isPending: query.isPending,
		ledgerError: error,
		isFetching: query.isFetching,
		retryLedger: query.refetch,
		page,
		setPage,
		pageSize,
		setPageSize: (value: number) => {
			setPageSizeValue(value);
			setPage(1);
		},
	};
}
