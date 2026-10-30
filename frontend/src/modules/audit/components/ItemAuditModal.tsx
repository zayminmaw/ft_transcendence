import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@global-components';
import { formatNumber } from '@utils/format';
import type { AuditEntry } from '../api';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { AuditDetailDialog } from './AuditDetailDialog';
import { AuditLogTable } from './AuditLogTable';

export type ItemAuditModalProps = {
	open: boolean;
	onClose: () => void;
	resourceType: string;
	recordId: string;
	// A second record shown in the same history, e.g. an invoice's payment.
	secondaryId?: string;
	title?: string;
};

// The history of one record, from the same audit endpoint as the company log.
export function ItemAuditModal({
	open,
	onClose,
	resourceType,
	recordId,
	secondaryId,
	title,
}: ItemAuditModalProps) {
	const { t, i18n } = useTranslation('audit');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);
	const [selected, setSelected] = useState<AuditEntry | null>(null);
	const recordIds = [recordId, secondaryId].filter(Boolean).join(',');
	const { data, isPending, isFetching, refetch } = useAuditLogs(
		{ resourceType, recordId: recordIds, page, pageSize },
		{ enabled: open },
	);
	const entries = data?.items ?? [];

	return (
		<>
			<Dialog
				open={open}
				onClose={onClose}
				title={title ? t('historyOf', { title }) : t('history')}
				className="w-11/12 max-w-6xl!"
				actions={
					<button type="button" className="btn" onClick={onClose}>
						{t('close')}
					</button>
				}
			>
				<div className="flex items-center justify-between gap-2 border-b border-base-300 pb-2">
					<span className="text-xs text-[var(--color-slate)] uppercase">
						{t('records')}{' '}
						<span className="badge badge-sm ms-1 font-mono">
							{formatNumber(data?.total, i18n.resolvedLanguage ?? 'en')}
						</span>
					</span>
					<button
						type="button"
						className="btn btn-sm btn-ghost"
						onClick={() => void refetch()}
						disabled={isFetching}
					>
						{isFetching && <span className="loading loading-spinner loading-xs" />}
						{t('refresh')}
					</button>
				</div>
				{isPending ? (
					<p className="flex items-center justify-center gap-2 py-12 text-[var(--color-slate)]">
						<span className="loading loading-spinner loading-sm" />
						{t('loading')}
					</p>
				) : entries.length === 0 ? (
					<div className="rounded-box border border-base-300 bg-base-200 px-6 py-12 text-center">
						<p className="font-medium">{t('emptyItem')}</p>
						<p className="mt-1 text-xs text-[var(--color-slate)]">
							{t('emptyItemHint')}
						</p>
					</div>
				) : (
					<div className="max-h-[60vh] overflow-y-auto">
						<AuditLogTable
							entries={entries}
							onSelect={setSelected}
							showResource={Boolean(secondaryId)}
							pagination={{
								page,
								pageSize,
								total: data?.total ?? 0,
								onPageChange: setPage,
								onPageSizeChange: (size) => {
									setPageSize(size);
									setPage(1);
								},
							}}
						/>
					</div>
				)}
			</Dialog>
			<AuditDetailDialog entry={selected} onClose={() => setSelected(null)} />
		</>
	);
}
