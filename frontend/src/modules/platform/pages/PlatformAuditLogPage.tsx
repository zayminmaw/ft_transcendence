import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModulePage, SelectFilter } from '@global-components';
import {
	AUDIT_ACTIONS,
	AUDIT_MODULES,
	AuditDetailDialog,
	AuditLogTable,
	type AuditAction,
	type AuditEntry,
} from '@modules/audit';
import {
	isPlatformAuditForbidden,
	usePlatformAuditEntry,
	usePlatformAuditLogs,
} from '../hooks/usePlatformAuditLogs';

// A day picked in the date inputs is a day in the viewer's time zone: send its start or end as UTC.
function dayBound(day: string, end: boolean): string | undefined {
	if (!day) return undefined;
	const parsed = new Date(`${day}T${end ? '23:59:59.999' : '00:00:00.000'}`);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function RefreshIcon() {
	return (
		<svg
			aria-hidden="true"
			className="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M21 12a9 9 0 1 1-2.64-6.36" />
			<path d="M21 3v6h-6" />
		</svg>
	);
}

// Platform-wide audit trail for platform administrators. Company business values are withheld by the server; reads
// are audited, so refreshes happen on demand.
export function PlatformAuditLogPage() {
	const { t: tp } = useTranslation('platform');
	const { t } = useTranslation('audit');
	const fromId = useId();
	const toId = useId();

	const [module, setModule] = useState('');
	const [action, setAction] = useState('');
	const [from, setFrom] = useState('');
	const [to, setTo] = useState('');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);
	const [selected, setSelected] = useState<AuditEntry | null>(null);

	const { data, isPending, isFetching, isPlaceholderData, error, refetch } = usePlatformAuditLogs(
		{
			module: module || undefined,
			action: (action || undefined) as AuditAction | undefined,
			from: dayBound(from, false),
			to: dayBound(to, true),
			page,
			pageSize,
		},
	);
	const detailQuery = usePlatformAuditEntry(selected?.id ?? null);

	const hasActiveFilters = Boolean(module || action || from || to);

	const filter = (set: (value: string) => void) => (value: string) => {
		set(value);
		setPage(1);
	};

	const clearFilters = () => {
		setModule('');
		setAction('');
		setFrom('');
		setTo('');
		setPage(1);
	};

	const header = (
		<ModulePage
			title={tp('audit.title')}
			description={tp('audit.description')}
			actions={
				<button
					type="button"
					className="btn btn-outline w-full gap-2 md:w-auto"
					onClick={() => void refetch()}
					disabled={isFetching}
				>
					{isFetching ? (
						<span className="loading loading-spinner loading-xs" aria-hidden="true" />
					) : (
						<RefreshIcon />
					)}
					{tp('audit.refresh')}
				</button>
			}
		/>
	);

	if (isPlatformAuditForbidden(error)) {
		return (
			<div className="flex flex-col gap-4">
				<ModulePage title={tp('audit.title')} description={tp('audit.description')} />
				<div className="rounded-box border border-base-300 bg-base-200 px-6 py-12 text-center">
					<p className="font-medium">{tp('audit.noAccess')}</p>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{tp('audit.noAccessHint')}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{header}

			<div
				role="search"
				aria-label={t('filters')}
				className="flex flex-wrap items-center justify-between gap-3"
			>
				<div className="flex flex-wrap items-end gap-2">
					<SelectFilter
						label={t('columns.module')}
						value={module}
						onChange={filter(setModule)}
						options={[
							{ value: '', label: t('all') },
							...AUDIT_MODULES.map((value) => ({
								value,
								label: t(`modules.${value}`),
							})),
						]}
					/>
					<SelectFilter
						label={t('columns.action')}
						value={action}
						onChange={filter(setAction)}
						options={[
							{ value: '', label: t('all') },
							...AUDIT_ACTIONS.map((value) => ({
								value,
								label: t(`actionNames.${value}`),
							})),
						]}
					/>
					<label htmlFor={fromId} className="input w-full sm:w-auto">
						<span className="label text-[var(--color-slate)]">{t('from')}</span>
						<input
							id={fromId}
							type="date"
							value={from}
							max={to || undefined}
							onChange={(event) => filter(setFrom)(event.target.value)}
						/>
					</label>
					<label htmlFor={toId} className="input w-full sm:w-auto">
						<span className="label text-[var(--color-slate)]">{t('to')}</span>
						<input
							id={toId}
							type="date"
							value={to}
							min={from || undefined}
							onChange={(event) => filter(setTo)(event.target.value)}
						/>
					</label>
					{hasActiveFilters && (
						<button
							type="button"
							className="btn btn-ghost btn-sm"
							onClick={clearFilters}
						>
							{tp('audit.clearFilters')}
						</button>
					)}
				</div>
				{data && (
					<span className="badge badge-soft badge-sm font-mono tabular-nums text-[var(--color-slate)]">
						{tp('audit.totalEntries', { count: data.total })}
					</span>
				)}
			</div>

			{!data ? (
				isPending ? (
					<p className="flex items-center justify-center gap-2 py-12 text-[var(--color-slate)]">
						<span className="loading loading-spinner loading-sm" aria-hidden="true" />
						{t('loading')}
					</p>
				) : (
					<div
						role="alert"
						className="rounded-box border border-base-300 bg-base-200 px-6 py-12 text-center"
					>
						<p className="font-medium">{tp('audit.loadFailed')}</p>
						<button
							type="button"
							className="btn btn-primary mt-4"
							onClick={() => void refetch()}
							disabled={isFetching}
						>
							{tp('audit.retry')}
						</button>
					</div>
				)
			) : (
				<div
					aria-busy={isPlaceholderData}
					className={`flex flex-col gap-4 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}
				>
					<AuditLogTable
						caption={tp('audit.caption')}
						entries={data.items}
						onSelect={setSelected}
						pagination={{
							page,
							pageSize,
							total: data.total,
							onPageChange: setPage,
							onPageSizeChange: (size) => {
								setPageSize(size);
								setPage(1);
							},
						}}
					/>
					<p className="text-xs text-[var(--color-slate)]">{tp('audit.privacyNote')}</p>
				</div>
			)}

			<AuditDetailDialog
				entry={selected}
				detail={detailQuery.data ?? null}
				onClose={() => setSelected(null)}
			/>
		</div>
	);
}
