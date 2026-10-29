import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast, type TableSort } from '@global-components';
import { useDebounced } from '@hooks/useDebounced';
import { tenantQueryKey } from '@utils/query-keys';
import type { DriverListParams, DriverSortKey, DriverStatusFilter } from '../api';
import { sampleDriversApi } from '../data/sampleDrivers';

// The driver list with its search, duty status filter, sort and paging; everyone by last name by default.
// Changing anything but the page goes back to page 1. The previous page stays on screen while the next one loads.
export function useDrivers() {
	const { t } = useTranslation('drivers');
	const [search, setSearchValue] = useState('');
	const [status, setStatusValue] = useState<DriverStatusFilter>('all');
	const [sort, setSortValue] = useState<TableSort | null>(null);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSizeValue] = useState(10);
	const debouncedSearch = useDebounced(search);
	const params: DriverListParams = {
		search: debouncedSearch,
		status,
		sort: (sort?.key as DriverSortKey | undefined) ?? 'lastName',
		direction: sort?.direction ?? 'asc',
		page,
		pageSize,
	};
	const query = useQuery({
		queryKey: tenantQueryKey('drivers', 'list', params),
		// GET /api/drivers?search=&status=&sort=&direction=&page=&pageSize= once the API exists.
		queryFn: () => sampleDriversApi.list(params),
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
		drivers: query.data?.items ?? [],
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

// One driver's details, for the details and edit pages.
export function useDriverDetails(driverId: string) {
	const { data, isPending, error } = useQuery({
		queryKey: tenantQueryKey('drivers', 'details', driverId),
		// GET /api/drivers/:id once the API exists.
		queryFn: () => sampleDriversApi.get(driverId),
	});
	return { driver: data, isDriverPending: isPending, driverError: error };
}
