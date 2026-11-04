import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast, type TableSort } from '@global-components';
import { useDebounced } from '@hooks/useDebounced';
import { tenantQueryKey } from '@utils/query-keys';
import { apiRequest } from '@services/api-client';
import {
	driverPath,
	type Driver,
	type DriverChoice,
	type DriverList,
	type DriverListParams,
	type DriverSortKey,
	type DriverStatusFilter,
} from '../api';

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
		// Trimmed here, so "abc" and "abc " share one cached answer.
		search: debouncedSearch.trim(),
		status,
		sort: (sort?.key as DriverSortKey | undefined) ?? 'lastName',
		direction: sort?.direction ?? 'asc',
		page,
		pageSize,
	};
	const query = useQuery({
		queryKey: tenantQueryKey('drivers', 'list', params),
		queryFn: () => {
			const search = new URLSearchParams({
				status: params.status,
				sort: params.sort,
				direction: params.direction,
				page: String(params.page),
				pageSize: String(params.pageSize),
			});
			if (params.search) search.set('search', params.search);
			return apiRequest<DriverList>(`drivers?${search}`);
		},
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
		queryFn: () => apiRequest<Driver>(driverPath(driverId)),
	});
	return { driver: data, isDriverPending: isPending, driverError: error };
}

// The drivers still employed, for other modules to choose from (e.g. checking an asset out). Under the drivers key,
// so onboarding or terminating a driver refreshes it.
export function useDriverChoices() {
	const { data, isPending, isError } = useQuery({
		queryKey: tenantQueryKey('drivers', 'choices'),
		queryFn: () => apiRequest<DriverChoice[]>('drivers/choices'),
	});
	return { driverChoices: data ?? [], isChoicesPending: isPending, isChoicesError: isError };
}
