import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useToast, type TableSort } from '@global-components';
import { useDebounced } from '@hooks/useDebounced';
import { apiRequest } from '@services/api-client';
import { tenantsQueryKey } from '@utils/query-keys';
import type {
	TenantDetails,
	TenantList,
	TenantListParams,
	TenantSortKey,
	TenantStatusFilter,
} from '../api';

// The tenant list with its search, status filter, sort and paging. Changing anything but the page goes back to
// page 1. The previous page stays on screen while the next one loads; platform data is never company data.
export function useTenants() {
	const [search, setSearchValue] = useState('');
	const [status, setStatusValue] = useState<TenantStatusFilter>('all');
	const [sort, setSortValue] = useState<TableSort | null>(null);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSizeValue] = useState(10);
	const debouncedSearch = useDebounced(search);
	const params: TenantListParams = {
		search: debouncedSearch,
		status,
		sort: (sort?.key as TenantSortKey | undefined) ?? 'name',
		direction: sort?.direction ?? 'asc',
		page,
		pageSize,
	};
	const query = useQuery({
		queryKey: [...tenantsQueryKey(), 'list', params],
		queryFn: () => {
			const query = new URLSearchParams({
				status: params.status,
				sort: params.sort,
				direction: params.direction,
				page: String(params.page),
				pageSize: String(params.pageSize),
			});
			if (params.search.trim()) query.set('search', params.search.trim());
			return apiRequest<TenantList>(`platform/tenants?${query}`);
		},
		placeholderData: keepPreviousData,
	});

	// One toast per failed load: errorUpdatedAt changes only when a new failure arrives.
	const { toast } = useToast();
	const { error, errorUpdatedAt } = query;
	useEffect(() => {
		if (error)
			toast({ variant: 'error', title: "Couldn't load tenants", description: error.message });
	}, [error, errorUpdatedAt, toast]);

	const firstPage =
		<T>(set: (value: T) => void) =>
		(value: T) => {
			set(value);
			setPage(1);
		};

	return {
		tenants: query.data?.items ?? [],
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

// One tenant's details, for the details and administrators pages.
export function useTenantDetails(tenantId: string) {
	const { data, isPending, isError } = useQuery({
		queryKey: [...tenantsQueryKey(), 'details', tenantId],
		queryFn: () =>
			apiRequest<TenantDetails>(`platform/tenants/${encodeURIComponent(tenantId)}`),
	});
	return { tenant: data, isTenantPending: isPending, isTenantError: isError };
}
