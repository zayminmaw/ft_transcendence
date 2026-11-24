import { useCallback, useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useToast, type TableSort } from '@global-components';
import { useDebounced } from '@hooks/useDebounced';
import { tenantQueryKey } from '@utils/query-keys';
import { apiRequest, retryServerErrors } from '@services/api-client';
import {
	parcelPath,
	type DispatchDriver,
	type ParcelDetails,
	type ParcelFormOptions,
	type ParcelList,
	type ParcelListParams,
	type ParcelQueue,
	type ParcelSortKey,
	type ParcelTracking,
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
// shortcut: only the 50 oldest. The parcel a link names is loaded on its own (AssignDriverPage), so it is never
// missed; a search in the picker would lift the cap.
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

// One parcel with its history. `enabled: false` loads nothing; isParcelPending is then false.
export function useParcelDetails(parcelId: string, enabled = true) {
	const { data, isLoading, refetch } = useQuery({
		queryKey: tenantQueryKey('parcels', 'details', parcelId),
		queryFn: () => apiRequest<ParcelDetails>(parcelPath(parcelId)),
		enabled,
	});
	const refreshParcel = useCallback(async () => {
		await refetch({ cancelRefetch: false, throwOnError: true });
	}, [refetch]);
	return { parcel: data, isParcelPending: isLoading, refreshParcel };
}

// The drivers on duty, with their vehicle and today's run. Under the parcels key, so an assignment refreshes the
// run counts. Needs parcels.dispatch: pass `enabled: false` without it, and isDriversPending is then false.
export function useDispatchDrivers(enabled = true) {
	const { data, isLoading } = useQuery({
		queryKey: tenantQueryKey('parcels', 'dispatch-drivers'),
		queryFn: () => apiRequest<DispatchDriver[]>('parcels/dispatch-drivers'),
		enabled,
	});
	return { dispatchDrivers: data ?? [], isDriversPending: isLoading };
}

// The merchants and zones the new parcel form chooses from.
export function useParcelFormOptions() {
	const { data, isPending } = useQuery({
		queryKey: tenantQueryKey('parcels', 'form-options'),
		queryFn: () => apiRequest<ParcelFormOptions>('parcels/form-options'),
	});
	return { options: data, isOptionsPending: isPending };
}

// A parcel on the public tracking page, by its waybill number: any company's, without signing in, so not under the
// tenant key. Waybill numbers are upper case, so "trc-…" and "TRC-…" share one answer.
export function useParcelTracking(trackingNumber: string | undefined) {
	const number = trackingNumber?.trim().toUpperCase() ?? '';
	const { data, error, isLoading, refetch } = useQuery({
		queryKey: ['tracking', number],
		queryFn: () => apiRequest<ParcelTracking>(`tracking/${encodeURIComponent(number)}`),
		enabled: number !== '',
		retry: retryServerErrors,
	});
	return {
		tracked: data,
		trackingError: error,
		isTrackingPending: isLoading,
		refetchTracking: refetch,
	};
}
