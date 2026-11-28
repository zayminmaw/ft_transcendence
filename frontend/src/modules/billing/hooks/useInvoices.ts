import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast } from '@global-components';
import { useDebounced } from '@hooks/useDebounced';
import { tenantQueryKey } from '@utils/query-keys';
import { apiBlob, apiRequest, errorCode } from '@services/api-client';
import type { InvoicePage, InvoiceStatus } from '../api';

export type InvoiceStatusFilter = '' | InvoiceStatus;

export type InvoiceClientChoice = {
	id: string;
	clientCode: string;
	businessName: string;
};

type ClientsPage = {
	items: InvoiceClientChoice[];
	total: number;
};

// Company-wide invoices list with search, status filter, pagination and summary counters.
// Sits under 'clients' so creating, issuing or paying out refreshes the register too.
export function useInvoices() {
	const { t } = useTranslation('billing');
	const [search, setSearchValue] = useState('');
	const [status, setStatusValue] = useState<InvoiceStatusFilter>('');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSizeValue] = useState(10);
	const debouncedSearch = useDebounced(search);
	const trimmedSearch = debouncedSearch.trim();
	const companyKey = tenantQueryKey('clients', 'invoices', 'company');

	const query = useQuery({
		queryKey: [...companyKey, { search: trimmedSearch, status, page, pageSize }],
		queryFn: () => {
			const params = new URLSearchParams({
				page: String(page),
				pageSize: String(pageSize),
			});
			if (status) params.set('status', status);
			if (trimmedSearch) params.set('search', trimmedSearch);
			return apiRequest<InvoicePage>(`billing/invoices?${params}`);
		},
		placeholderData: (previous, previousQuery) =>
			companyKey.every((part, index) => previousQuery?.queryKey[index] === part)
				? previous
				: undefined,
	});

	const { toast } = useToast();
	const { error, errorUpdatedAt } = query;
	useEffect(() => {
		if (error) {
			toast({
				variant: 'error',
				title: t('invoices.loadFailed'),
				description: error.message,
			});
		}
	}, [error, errorUpdatedAt, toast, t]);

	const resetPage =
		<T>(set: (value: T) => void) =>
		(value: T) => {
			set(value);
			setPage(1);
		};

	return {
		invoices: query.data?.items ?? [],
		total: query.data?.total ?? 0,
		summary: query.data?.summary,
		isPending: query.isPending,
		invoicesError: error,
		isFetching: query.isFetching,
		retryInvoices: query.refetch,
		search,
		setSearch: resetPage(setSearchValue),
		status,
		setStatus: resetPage(setStatusValue),
		page,
		setPage,
		pageSize,
		setPageSize: resetPage(setPageSizeValue),
	};
}

// Downloads the filtered company invoices as an RFC-4180 CSV file (billing.export).
export function useExportInvoices() {
	const { t } = useTranslation('billing');
	const { toast } = useToast();

	const mutation = useMutation({
		mutationFn: async (filters: { status?: InvoiceStatusFilter; search?: string }) => {
			const params = new URLSearchParams();
			if (filters.status) params.set('status', filters.status);
			const trimmed = filters.search?.trim();
			if (trimmed) params.set('search', trimmed);
			const suffix = params.toString() ? `?${params}` : '';
			const blob = await apiBlob(`billing/invoices/export${suffix}`);
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = 'invoices-export.csv';
			document.body.append(link);
			link.click();
			link.remove();
			// Defer revocation slightly so the browser starts the download cleanly.
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		},
		onError: (error) => {
			toast({
				variant: 'error',
				title: t('invoices.export.failed'),
				description:
					errorCode(error) === 'INVOICE_EXPORT_TOO_LARGE'
						? t('invoices.export.tooLarge')
						: error instanceof Error
							? error.message
							: undefined,
			});
		},
	});

	return {
		exportInvoices: mutation.mutate,
		isExporting: mutation.isPending,
	};
}

// Minimal merchant choices under billing.create_invoice, including archived merchants.
export function useInvoiceClients(enabled: boolean) {
	const query = useQuery({
		queryKey: tenantQueryKey('clients', 'invoice-picker'),
		enabled,
		queryFn: async () => {
			const pageSize = 50;
			const first = await apiRequest<ClientsPage>(
				`billing/invoices/clients?page=1&pageSize=${pageSize}`,
			);
			const items = [...first.items];
			const totalPages = Math.ceil(first.total / pageSize);
			for (let page = 2; page <= totalPages; page++) {
				const next = await apiRequest<ClientsPage>(
					`billing/invoices/clients?page=${page}&pageSize=${pageSize}`,
				);
				items.push(...next.items);
			}
			return items;
		},
	});

	return {
		clients: query.data ?? [],
		isClientsPending: query.isPending,
		clientsError: query.error,
		retryClients: query.refetch,
	};
}
