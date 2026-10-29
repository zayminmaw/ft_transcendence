import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModulePage, SelectFilter } from '@global-components';
import { AUDIT_ACTIONS, type AuditAction, type AuditEntry } from '../api';
import { AuditDetailDialog } from '../components/AuditDetailDialog';
import { AuditLogTable } from '../components/AuditLogTable';
import { isForbidden, useAuditLogs } from '../hooks/useAuditLogs';
import { lookup } from '../utils/describe';

const MODULES = [
	'auth',
	'members',
	'platform',
	'parcels',
	'clients',
	'billing',
	'staff',
	'drivers',
	'assets',
	'audit',
];

// A day picked in the date inputs is a day in the viewer's time zone: send its start or end as UTC.
function dayBound(day: string, end: boolean): string | undefined {
	if (!day) return undefined;
	return new Date(`${day}T${end ? '23:59:59.999' : '00:00:00.000'}`).toISOString();
}

// The company's audit trail: who changed what, when and from where. Needs admin.audit_logs.
export function AuditLogPage() {
	const { t } = useTranslation('audit');
	const [module, setModule] = useState('');
	const [action, setAction] = useState('');
	const [from, setFrom] = useState('');
	const [to, setTo] = useState('');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);
	const [selected, setSelected] = useState<AuditEntry | null>(null);
	const { data, isPending, error } = useAuditLogs({
		module: module || undefined,
		action: (action || undefined) as AuditAction | undefined,
		from: dayBound(from, false),
		to: dayBound(to, true),
		page,
		pageSize,
	});

	// Changing a filter goes back to page 1.
	const filter = (set: (value: string) => void) => (value: string) => {
		set(value);
		setPage(1);
	};

	// Opened by link without admin.audit_logs: say so plainly instead of showing an empty, failing table.
	if (isForbidden(error)) {
		return (
			<div className="flex flex-col gap-4">
				<ModulePage title={t('pageTitle')} description={t('pageDescription')} />
				<div className="rounded-box border border-base-300 bg-base-200 px-6 py-12 text-center">
					<p className="font-medium">{t('noAccess')}</p>
					<p className="mt-1 text-xs text-[var(--color-slate)]">{t('noAccessHint')}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<ModulePage title={t('pageTitle')} description={t('pageDescription')} />
			<section aria-label={t('filters')} className="flex flex-wrap items-end gap-2">
				<SelectFilter
					label={t('columns.module')}
					value={module}
					onChange={filter(setModule)}
					options={[
						{ value: '', label: t('all') },
						...MODULES.map((value) => ({
							value,
							label: lookup(t, 'modules', value),
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
				<label className="input w-full sm:w-auto">
					<span className="label text-[var(--color-slate)]">{t('from')}</span>
					<input
						type="date"
						value={from}
						max={to || undefined}
						onChange={(event) => filter(setFrom)(event.target.value)}
					/>
				</label>
				<label className="input w-full sm:w-auto">
					<span className="label text-[var(--color-slate)]">{t('to')}</span>
					<input
						type="date"
						value={to}
						min={from || undefined}
						onChange={(event) => filter(setTo)(event.target.value)}
					/>
				</label>
			</section>
			{isPending ? (
				<p className="flex items-center justify-center gap-2 py-12 text-[var(--color-slate)]">
					<span className="loading loading-spinner loading-sm" />
					{t('loading')}
				</p>
			) : (
				<AuditLogTable
					entries={data?.items ?? []}
					onSelect={setSelected}
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
			)}
			<AuditDetailDialog entry={selected} onClose={() => setSelected(null)} />
		</div>
	);
}
