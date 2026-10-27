import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useToast, type TableSort } from '@global-components';
import { useDebounced } from '@hooks/useDebounced';
import { apiRequest } from '@services/api-client';
import { tenantsQueryKey } from '@utils/query-keys';
import type { ActivityFilter, ActivitySortKey, TenantActivity, TenantActivityParams } from '../api';

// The tenant management events with their search, action filter, sort and paging, newest first by default. Like
// useTenants, changing anything but the page goes back to page 1. The key sits under tenantsQueryKey, so every
// tenant change refreshes it.
export function useTenantActivity() {
	const { toast } = useToast();
	const [search, setSearchValue] = useState('');
	const [action, setActionValue] = useState<ActivityFilter>('all');
	const [sort, setSortValue] = useState<TableSort | null>(null);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSizeValue] = useState(10);
	const debouncedSearch = useDebounced(search);

	const params: TenantActivityParams = {
		search: debouncedSearch,
		action,
		sort: (sort?.key as ActivitySortKey | undefined) ?? 'createdAt',
		direction: sort?.direction ?? 'desc',
		page,
		pageSize,
	};
	const query = useQuery({
		queryKey: [...tenantsQueryKey(), 'activity', params],
		queryFn: () => {
			const query = new URLSearchParams({
				action: params.action,
				sort: params.sort,
				direction: params.direction,
				page: String(params.page),
				pageSize: String(params.pageSize),
			});
			if (params.search.trim()) query.set('search', params.search.trim());
			return apiRequest<TenantActivity>(`platform/activity?${query}`);
		},
		placeholderData: keepPreviousData,
	});

	// One toast per failed load: errorUpdatedAt changes only when a new failure arrives.
	const { error, errorUpdatedAt } = query;
	useEffect(() => {
		if (error)
			toast({
				variant: 'error',
				title: "Couldn't load tenant activity",
				description: error.message,
			});
	}, [error, errorUpdatedAt, toast]);

	const firstPage =
		<T>(set: (value: T) => void) =>
		(value: T) => {
			set(value);
			setPage(1);
		};

	return {
		events: query.data?.items ?? [],
		total: query.data?.total ?? 0,
		counts: query.data?.counts,
		isPending: query.isPending,
		search,
		setSearch: firstPage(setSearchValue),
		action,
		setAction: firstPage(setActionValue),
		sort,
		setSort: firstPage(setSortValue),
		page,
		setPage,
		pageSize,
		setPageSize: firstPage(setPageSizeValue),
	};
}
