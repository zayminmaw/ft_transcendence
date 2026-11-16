import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast, type TableSort } from '@global-components';
import { useDebounced } from '@hooks/useDebounced';
import { tenantQueryKey } from '@utils/query-keys';
import { apiRequest } from '@services/api-client';
import {
	assetPath,
	type AssetDetails,
	type AssetList,
	type AssetListParams,
	type AssetSortKey,
	type AssetStatusFilter,
} from '../api';

// The asset list with its search, status filter, sort and paging; by asset tag by default. Changing anything but
// the page goes back to page 1. The previous page stays on screen while the next one loads.
export function useAssets() {
	const { t } = useTranslation('assets');
	const [search, setSearchValue] = useState('');
	const [status, setStatusValue] = useState<AssetStatusFilter>('all');
	const [sort, setSortValue] = useState<TableSort | null>(null);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSizeValue] = useState(10);
	const debouncedSearch = useDebounced(search);
	const params: AssetListParams = {
		// Trimmed here, so "abc" and "abc " share one cached answer.
		search: debouncedSearch.trim(),
		status,
		sort: (sort?.key as AssetSortKey | undefined) ?? 'assetTag',
		direction: sort?.direction ?? 'asc',
		page,
		pageSize,
	};
	const query = useQuery({
		queryKey: tenantQueryKey('assets', 'list', params),
		queryFn: () => {
			const search = new URLSearchParams({
				status: params.status,
				sort: params.sort,
				direction: params.direction,
				page: String(params.page),
				pageSize: String(params.pageSize),
			});
			if (params.search) search.set('search', params.search);
			return apiRequest<AssetList>(`assets?${search}`);
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
		assets: query.data?.items ?? [],
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

// One asset with its history, for the details and edit pages.
export function useAssetDetails(assetId: string) {
	const { data, isPending, error } = useQuery({
		queryKey: tenantQueryKey('assets', 'details', assetId),
		queryFn: () => apiRequest<AssetDetails>(assetPath(assetId)),
	});
	return { asset: data, isAssetPending: isPending, assetError: error };
}
