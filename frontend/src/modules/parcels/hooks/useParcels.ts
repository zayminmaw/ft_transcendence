import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useToast, type TableSort } from '@global-components';
import { useDebounced } from '@hooks/useDebounced';
import { tenantQueryKey } from '@utils/query-keys';
import { apiRequest } from '@services/api-client';
import {
	parcelPath,
	type DispatchDriver,
	type ParcelDetails,
	type ParcelFormOptions,
	type ParcelList,
	type ParcelListParams,
	type ParcelQueue,
	type ParcelSortKey,
} from '../api';

function listPath(params: ParcelListParams) {
	const search = new URLSearchParams({
		queue: params.queue,
		sort: params.sort,
		direction: params.direction,
		page: String(params.page),
		pageSize: String(params.pageSize),
	});
	if (params.search) search.set('search', params.search);
	return `parcels?${search}`;
}

// The parcel queue with its search, queue filter, sort and paging; newest first by default. Changing anything but
// the page goes back to page 1. The previous page stays on screen while the next one loads.
export function useParcels() {
	const [search, setSearchValue] = useState('');
	const [queue, setQueueValue] = useState<ParcelQueue>('all');
	const [sort, setSortValue] = useState<TableSort | null>(null);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSizeValue] = useState(10);
	const debouncedSearch = useDebounced(search);
	const params: ParcelListParams = {
		// Trimmed here, so "abc" and "abc " share one cached answer.
		search: debouncedSearch.trim(),
		queue,
		sort: (sort?.key as ParcelSortKey | undefined) ?? 'createdAt',
		direction: sort?.direction ?? 'desc',
		page,
		pageSize,
	};
	const query = useQuery({
		queryKey: tenantQueryKey('parcels', 'list', params),
		queryFn: () => apiRequest<ParcelList>(listPath(params)),
		placeholderData: keepPreviousData,
	});

	// One toast per failed load: errorUpdatedAt changes only when a new failure arrives.
	const { toast } = useToast();
	const { error, errorUpdatedAt } = query;
	useEffect(() => {
		if (error)
			toast({
				variant: 'error',
				title: "Parcels couldn't be loaded",
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
		parcels: query.data?.items ?? [],
		total: query.data?.total ?? 0,
		counts: query.data?.counts,
		isPending: query.isPending,
		search,
		setSearch: firstPage(setSearchValue),
		queue,
		setQueue: firstPage(setQueueValue),
		sort,
		setSort: firstPage(setSortValue),
		page,
		setPage,
		pageSize,
		setPageSize: firstPage(setPageSizeValue),
	};
}

// The parcels a dispatcher can (re)assign, oldest first, for the assign page's choice.
export function useAssignableParcels() {
	const params: ParcelListParams = {
		search: '',
		queue: 'assignable',
		sort: 'createdAt',
		direction: 'asc',
		page: 1,
		pageSize: 50,
	};
	const { data, isPending } = useQuery({
		queryKey: tenantQueryKey('parcels', 'list', params),
		queryFn: () => apiRequest<ParcelList>(listPath(params)),
	});
	return { assignable: data?.items ?? [], isAssignablePending: isPending };
}

// One parcel with its history.
export function useParcelDetails(parcelId: string) {
	const { data, isPending } = useQuery({
		queryKey: tenantQueryKey('parcels', 'details', parcelId),
		queryFn: () => apiRequest<ParcelDetails>(parcelPath(parcelId)),
	});
	return { parcel: data, isParcelPending: isPending };
}

// The drivers on duty, with their vehicle and today's run. Under the parcels key, so an assignment refreshes the
// run counts.
export function useDispatchDrivers() {
	const { data, isPending } = useQuery({
		queryKey: tenantQueryKey('parcels', 'dispatch-drivers'),
		queryFn: () => apiRequest<DispatchDriver[]>('parcels/dispatch-drivers'),
	});
	return { dispatchDrivers: data ?? [], isDriversPending: isPending };
}

// The merchants and zones the new parcel form chooses from.
export function useParcelFormOptions() {
	const { data, isPending } = useQuery({
		queryKey: tenantQueryKey('parcels', 'form-options'),
		queryFn: () => apiRequest<ParcelFormOptions>('parcels/form-options'),
	});
	return { options: data, isOptionsPending: isPending };
}
