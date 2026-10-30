import { useEffect } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast } from '@global-components';
import { ApiError, apiRequest } from '@services/api-client';
import { tenantQueryKey } from '@utils/query-keys';
import { auditSearch, type AuditEntry, type AuditFilters, type AuditPage } from '../api';

// A page of the company's audit trail. The previous page stays on screen while the next one loads.
export function useAuditLogs(
	filters: AuditFilters,
	{ enabled = true }: { enabled?: boolean } = {},
) {
	const { t } = useTranslation('audit');
	const query = useQuery({
		queryKey: tenantQueryKey('audit-logs', 'list', filters),
		queryFn: () => apiRequest<AuditPage>(`audit-logs?${auditSearch(filters)}`),
		placeholderData: keepPreviousData,
		// Every load is audited as a read, so don't reload just because the window got focus back.
		refetchOnWindowFocus: false,
		enabled,
		// A refusal won't change on retry.
		retry: (failures, error) => !isForbidden(error) && failures < 3,
	});

	// One toast per failed load: errorUpdatedAt changes only when a new failure arrives. A refusal is shown by the
	// screen itself, not as an error.
	const { toast } = useToast();
	const { error, errorUpdatedAt } = query;
	useEffect(() => {
		if (error && !isForbidden(error))
			toast({ variant: 'error', title: t('loadFailed'), description: error.message });
	}, [error, errorUpdatedAt, toast, t]);

	return query;
}

// One entry with its user agent, for the details dialog. Opening it is audited as a read.
export function useAuditEntry(id: string | null) {
	return useQuery({
		queryKey: tenantQueryKey('audit-logs', 'entry', id),
		queryFn: () => apiRequest<AuditEntry>(`audit-logs/${encodeURIComponent(id!)}`),
		enabled: id !== null,
		refetchOnWindowFocus: false,
	});
}

// Whether this person may read the company's audit trail, so audit buttons only show for them. The server still
// checks every read.
export function useAuditAccess(): boolean {
	const { data } = useQuery({
		queryKey: tenantQueryKey('audit-logs', 'access'),
		queryFn: () =>
			apiRequest<{ canRead: boolean }>('audit-logs/access').catch((error: unknown) => {
				if (error instanceof ApiError && error.status === 403) return { canRead: false };
				throw error;
			}),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});
	return data?.canRead === true;
}

export function isForbidden(error: unknown): boolean {
	return error instanceof ApiError && error.status === 403;
}
