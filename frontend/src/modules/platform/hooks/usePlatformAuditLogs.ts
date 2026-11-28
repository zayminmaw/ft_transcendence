import { useEffect } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast } from '@global-components';
import { auditSearch, type AuditEntry, type AuditFilters, type AuditPage } from '@modules/audit';
import { ApiError, apiRequest } from '@services/api-client';
import { platformQueryKey } from '@utils/query-keys';

export function isPlatformAuditForbidden(error: unknown): boolean {
	return error instanceof ApiError && error.status === 403;
}

// A page of the platform-wide audit trail. Reads are audited on the server, so background refetches on focus or
// reconnect are disabled; platform administrators refresh manually when needed.
export function usePlatformAuditLogs(filters: AuditFilters) {
	const { t } = useTranslation('platform');
	const query = useQuery({
		queryKey: platformQueryKey('audit-logs', 'list', filters),
		queryFn: () => apiRequest<AuditPage>(`platform/audit-logs?${auditSearch(filters)}`),
		placeholderData: keepPreviousData,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		retry: (failures, error) => !isPlatformAuditForbidden(error) && failures < 2,
	});

	const { toast } = useToast();
	const { error, errorUpdatedAt } = query;
	useEffect(() => {
		if (error && !isPlatformAuditForbidden(error)) {
			toast({ variant: 'error', title: t('audit.loadFailed'), description: error.message });
		}
	}, [error, errorUpdatedAt, toast, t]);

	return query;
}

// One platform audit entry in full (including user agent) for the detail dialog. Opening it is audited as a read.
export function usePlatformAuditEntry(id: string | null) {
	const { t } = useTranslation('platform');
	const query = useQuery({
		queryKey: platformQueryKey('audit-logs', 'entry', id),
		queryFn: () => apiRequest<AuditEntry>(`platform/audit-logs/${encodeURIComponent(id!)}`),
		enabled: id !== null,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		retry: (failures, error) => !isPlatformAuditForbidden(error) && failures < 2,
	});

	const { toast } = useToast();
	const { error, errorUpdatedAt } = query;
	useEffect(() => {
		if (error && !isPlatformAuditForbidden(error)) {
			toast({
				variant: 'error',
				title: t('audit.detailLoadFailed'),
				description: error.message,
			});
		}
	}, [error, errorUpdatedAt, toast, t]);

	return query;
}
