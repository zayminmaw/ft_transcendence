import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SelectFilter, Table, type TableColumn } from '@global-components';
import {
	ActionBadge,
	describeEntry,
	lookup,
	resourceName,
	resourceText,
	type AuditEntry,
	type AuditFilters,
} from '@modules/audit';
import { formatDate } from '@utils/format';
import { useMyActivity } from '../hooks';

type ActivityFilter =
	'all' | 'login' | 'login_failed' | 'logout' | 'password_changed' | 'profile_updated';

const OUTCOME_TONE: Record<AuditEntry['outcome'], string> = {
	success: 'badge-success',
	failure: 'badge-error',
	denied: 'badge-error',
};

function toAuditFilters(filter: ActivityFilter, page: number, pageSize: number): AuditFilters {
	if (filter === 'all') return { page, pageSize };
	if (filter === 'profile_updated') {
		return { module: 'auth', resourceType: 'user', action: 'update', page, pageSize };
	}
	return { action: filter, page, pageSize };
}

function RefreshIcon() {
	return (
		<svg
			aria-hidden="true"
			className="size-4 shrink-0"
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

function ActivityTableSkeleton({ label }: { label: string }) {
	return (
		<div className="mt-6 flex flex-col gap-3" aria-busy="true">
			<span className="sr-only">{label}</span>
			<div className="skeleton h-10 w-full rounded-field" />
			{Array.from({ length: 5 }, (_, index) => (
				<div
					key={index}
					className="flex flex-wrap items-center gap-4 border-b border-base-300 py-4 last:border-b-0"
				>
					<div className="skeleton h-4 w-32" />
					<div className="skeleton h-5 w-24 rounded-full" />
					<div className="skeleton h-4 min-w-44 flex-1" />
					<div className="skeleton h-5 w-20 rounded-full" />
					<div className="skeleton h-4 w-24" />
				</div>
			))}
		</div>
	);
}

// Personal account activity from GET /api/audit-logs/mine. Works across /profile, /app/:slug/profile, and
// /platform/profile without needing X-Organization-Id.
export function AccountActivitySection() {
	const { t, i18n } = useTranslation('auth');
	const { t: tAudit } = useTranslation('audit');
	const language = i18n.resolvedLanguage ?? 'en';
	const [filter, setFilter] = useState<ActivityFilter>('all');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);

	const activity = useMyActivity(toAuditFilters(filter, page, pageSize));
	const entries = activity.data?.items ?? [];
	const total = activity.data?.total ?? 0;

	const filterOptions = [
		{ value: 'all', label: t('profile.activity.filters.all') },
		{ value: 'login', label: t('profile.activity.filters.login') },
		{ value: 'login_failed', label: t('profile.activity.filters.loginFailed') },
		{ value: 'logout', label: t('profile.activity.filters.logout') },
		{ value: 'password_changed', label: t('profile.activity.filters.passwordChanged') },
		{ value: 'profile_updated', label: t('profile.activity.filters.profileUpdated') },
	];

	const columns: TableColumn<AuditEntry>[] = [
		{
			key: 'time',
			header: t('profile.activity.columns.time'),
			className: 'whitespace-nowrap',
			cell: (entry) => (
				<time
					dateTime={entry.occurredAt}
					className="font-mono text-xs tabular-nums text-[var(--color-slate)]"
				>
					<bdi>
						{formatDate(entry.occurredAt, language, {
							dateStyle: 'medium',
							timeStyle: 'short',
						})}
					</bdi>
				</time>
			),
		},
		{
			key: 'action',
			header: t('profile.activity.columns.action'),
			className: 'whitespace-nowrap',
			cell: (entry) => <ActionBadge entry={entry} showSrOutcome={false} />,
		},
		{
			key: 'summary',
			header: t('profile.activity.columns.summary'),
			className: 'min-w-60',
			cell: (entry) => {
				const label = resourceText(entry);
				return (
					<div className="flex flex-col gap-1">
						<p className="text-sm font-medium text-base-content">
							{describeEntry(tAudit, entry)}
						</p>
						<div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-slate)]">
							<span className="badge badge-xs border-base-300 bg-base-200 font-normal">
								{lookup(tAudit, 'modules', entry.module)}
							</span>
							{entry.resource.type && (
								<span>
									{resourceName(tAudit, entry.resource.type)}
									{label && (
										<>
											{' '}
											<bdi dir="ltr" className="font-mono">
												{label}
											</bdi>
										</>
									)}
								</span>
							)}
						</div>
					</div>
				);
			},
		},
		{
			key: 'outcome',
			header: t('profile.activity.columns.outcome'),
			className: 'whitespace-nowrap',
			cell: (entry) => (
				<span
					className={`badge badge-sm badge-soft whitespace-nowrap ${OUTCOME_TONE[entry.outcome]}`}
				>
					{tAudit(`outcomes.${entry.outcome}`)}
				</span>
			),
		},
		{
			key: 'ip',
			header: t('profile.activity.columns.ip'),
			className: 'whitespace-nowrap',
			cell: (entry) => {
				const ip = entry.ip?.replace(/^::ffff:/, '');
				return ip ? (
					<span
						dir="ltr"
						className="inline-block font-mono text-xs tabular-nums text-[var(--color-slate)]"
					>
						{ip}
					</span>
				) : (
					<span
						className="text-xs text-[var(--color-slate)]"
						aria-label={t('profile.activity.noIp')}
					>
						—
					</span>
				);
			},
		},
	];

	return (
		<section className="rounded-box border border-base-300 p-6 md:p-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 id="profile-activity" className="text-lg font-semibold">
						{t('profile.activity.title')}
					</h2>
					<p className="mt-1 text-sm text-[var(--color-slate)]">
						{t('profile.activity.description')}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<SelectFilter
						label={t('profile.activity.filterLabel')}
						value={filter}
						onChange={(value) => {
							setFilter(value as ActivityFilter);
							setPage(1);
						}}
						options={filterOptions}
						className="select-sm"
					/>
					<button
						type="button"
						className="btn btn-sm btn-ghost border border-base-300"
						onClick={() => void activity.refetch()}
						disabled={activity.isFetching}
					>
						{activity.isFetching ? (
							<span
								className="loading loading-spinner loading-xs"
								aria-hidden="true"
							/>
						) : (
							<RefreshIcon />
						)}
						{activity.isFetching
							? t('profile.activity.refreshing')
							: t('profile.activity.refresh')}
					</button>
				</div>
			</div>

			{activity.isPending ? (
				<ActivityTableSkeleton label={t('profile.activity.loading')} />
			) : activity.isError ? (
				<div
					role="alert"
					className="alert alert-error alert-soft mt-6 flex flex-wrap items-center justify-between gap-4"
				>
					<div>
						<p className="font-medium">{t('profile.activity.loadFailed')}</p>
						<p className="mt-0.5 text-xs opacity-80">
							{t('profile.activity.loadFailedHint')}
						</p>
					</div>
					<button
						type="button"
						className="btn btn-sm btn-outline shrink-0"
						onClick={() => void activity.refetch()}
						disabled={activity.isFetching}
					>
						{t('profile.activity.retry')}
					</button>
				</div>
			) : entries.length === 0 ? (
				<div className="mt-6 rounded-box border border-base-300 bg-base-200 px-6 py-10 text-center">
					<p className="font-medium">
						{filter === 'all'
							? t('profile.activity.empty')
							: t('profile.activity.emptyFiltered')}
					</p>
					{filter === 'all' ? (
						<p className="mt-1 text-xs text-[var(--color-slate)]">
							{t('profile.activity.emptyHint')}
						</p>
					) : (
						<button
							type="button"
							className="btn btn-sm btn-ghost mt-4 border border-base-300 bg-base-100"
							onClick={() => {
								setFilter('all');
								setPage(1);
							}}
						>
							{t('profile.activity.clearFilter')}
						</button>
					)}
				</div>
			) : (
				<div
					className={`mt-6 transition-opacity ${activity.isFetching ? 'opacity-60' : ''}`}
				>
					<Table
						caption={t('profile.activity.caption')}
						columns={columns}
						rows={entries}
						getRowKey={(entry) => entry.id}
						pagination={{
							page,
							pageSize,
							total,
							onPageChange: setPage,
							onPageSizeChange: (size) => {
								setPageSize(size);
								setPage(1);
							},
						}}
					/>
				</div>
			)}
		</section>
	);
}
