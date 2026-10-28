import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast, type TableSort } from '@global-components';
import { useDebounced } from '@hooks/useDebounced';
import { tenantQueryKey } from '@utils/query-keys';
import type { ClientListParams, ClientSortKey, ClientStatusFilter } from '../api';
import { sampleClientsApi } from '../data/sampleClients';

// The merchant list with its search, status filter, sort and paging; active clients by name by default. Changing
// anything but the page goes back to page 1. The previous page stays on screen while the next one loads.
export function useClients() {
	const { t } = useTranslation('clients');
	const [search, setSearchValue] = useState('');
	const [status, setStatusValue] = useState<ClientStatusFilter>('active');
	const [sort, setSortValue] = useState<TableSort | null>(null);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSizeValue] = useState(10);
	const debouncedSearch = useDebounced(search);
	const params: ClientListParams = {
		search: debouncedSearch,
		status,
		sort: (sort?.key as ClientSortKey | undefined) ?? 'businessName',
		direction: sort?.direction ?? 'asc',
		page,
		pageSize,
	};
	const query = useQuery({
		queryKey: tenantQueryKey('clients', 'list', params),
		// GET /api/clients?search=&status=&sort=&direction=&page=&pageSize= once the API exists.
		queryFn: () => sampleClientsApi.list(params),
		placeholderData: keepPreviousData,
	});

	// One toast per failed load: errorUpdatedAt changes only when a new failure arrives.
	const { toast } = useToast();
	const { error, errorUpdatedAt } = query;
	useEffect(() => {
		if (error)
			toast({ variant: 'error', title: t('page.loadFailed'), description: error.message });
	}, [error, errorUpdatedAt, toast, t]);

	const firstPage =
		<T>(set: (value: T) => void) =>
		(value: T) => {
			set(value);
			setPage(1);
		};

	return {
		clients: query.data?.items ?? [],
		total: query.data?.total ?? 0,
		counts: query.data?.counts,
		isPending: query.isPending,
		search,
		setSearch: firstPage(setSearchValue),
		status,
		setStatus: firstPage(setStatusValue),
		sort,
		setSort: firstPage(setSortValue),
		page,
		setPage,
		pageSize,
		setPageSize: firstPage(setPageSizeValue),
	};
}

// One client's details, for the details and edit pages.
export function useClientDetails(clientId: string) {
	const { data, isPending, isError, error } = useQuery({
		queryKey: tenantQueryKey('clients', 'details', clientId),
		// GET /api/clients/:id once the API exists.
		queryFn: () => sampleClientsApi.get(clientId),
	});
	return { client: data, isClientPending: isPending, isClientError: isError, clientError: error };
}
