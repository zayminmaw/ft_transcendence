import { useState } from 'react';
import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnalyticsCard, Dialog, ModulePage, Table } from '@global-components';
import { useRoleName } from '@modules/auth';
import type { AnalyticsItem, TableColumn } from '@global-components';
import { formatDate, formatNumber } from '@utils/format';
import type { ActivityDetails, ActivityFilter, TenantActivityEvent } from '../api';
import { useTenantActivity } from '../hooks/useTenantActivity';

const actionFilters = ['all', 'created', 'details', 'status', 'administrators'] as const;
const actionKeys = ['create', 'update', 'suspend', 'reactivate', 'assign', 'revoke'] as const;
const fieldKeys = ['name', 'contactEmail', 'contactPhone', 'address'] as const;

// "tenant.administrator.assign" → "assign"; the six actions differ in their last word.
const actionKey = (action: string) => actionKeys.find((key) => action.endsWith(`.${key}`));

// One sentence on what changed, from the event's details.
function summary(
	t: TFunction<'platform'>,
	language: string,
	roleLabel: (code: string) => string,
	{ action, details }: { action: string; details: ActivityDetails },
): string {
	const administrator = details.administrator ?? t('activity.anAdministrator');
	switch (action) {
		case 'tenant.create':
			return details.administrator
				? t('activity.summary.createdWith', { administrator })
				: t('activity.summary.created');
		case 'tenant.update': {
			const fields = new Intl.ListFormat(language, { type: 'conjunction' }).format(
				(details.fields ?? []).map((field) =>
					fieldKeys.includes(field as (typeof fieldKeys)[number])
						? t(`activity.fields.${field as (typeof fieldKeys)[number]}`)
						: field,
				),
			);
			return fields
				? t('activity.summary.changed', { fields })
				: t('activity.summary.detailsChanged');
		}
		case 'tenant.suspend':
			return details.cause === 'last_administrator_revoked'
				? t('activity.summary.suspendedLast', { administrator })
				: t('activity.summary.suspended');
		case 'tenant.reactivate':
			return t('activity.summary.reactivated');
		case 'tenant.administrator.assign':
			if (details.account === 'new')
				return t('activity.summary.newAccount', { administrator });
			return details.previousRole
				? t('activity.summary.promotedFrom', {
						administrator,
						role: roleLabel(details.previousRole),
					})
				: t('activity.summary.promoted', { administrator });
		case 'tenant.administrator.revoke':
			return details.revoke === 'change_role' && details.role
				? t('activity.summary.movedRole', { administrator, role: roleLabel(details.role) })
				: t('activity.summary.removed', { administrator });
		default:
			return t('activity.summary.other');
	}
}

export function TenantActivityPage() {
	const { t, i18n } = useTranslation('platform');
	const actionLabel = (event: TenantActivityEvent) => {
		const key = actionKey(event.action);
		return key ? t(`activity.actions.${key}`) : event.action;
	};
	const roleName = useRoleName();
	// Role codes (dispatcher, org_admin) by their shared name, or as words for a code with none.
	const roleLabel = (code: string) => roleName({ code, name: code.replaceAll('_', ' ') });
	const describe = (event: TenantActivityEvent) =>
		summary(t, i18n.resolvedLanguage ?? 'en', roleLabel, event);
	const {
		events,
		total,
		counts,
		isPending,
		search,
		setSearch,
		action,
		setAction,
		sort,
		setSort,
		page,
		setPage,
		pageSize,
		setPageSize,
	} = useTenantActivity();
	const [selected, setSelected] = useState<TenantActivityEvent | null>(null);

	const time = (event: TenantActivityEvent) =>
		formatDate(event.createdAt, i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

	const activityStats: AnalyticsItem[] = [
		{
			label: t('activity.stats.events'),
			value: formatNumber(counts?.events, i18n.language),
			description: t('activity.stats.eventsNote'),
		},
		{
			label: t('activity.stats.status'),
			value: formatNumber(counts?.status, i18n.language),
			description: t('activity.stats.statusNote'),
		},
		{
			label: t('activity.stats.administrators'),
			value: formatNumber(counts?.administrators, i18n.language),
			description: t('activity.stats.administratorsNote'),
		},
		{
			label: t('activity.stats.records'),
			value: formatNumber(counts && counts.created + counts.details, i18n.language),
			description: t('activity.stats.recordsNote'),
		},
	];

	const columns: TableColumn<TenantActivityEvent>[] = [
		{
			key: 'createdAt',
			header: t('activity.columns.time'),
			sortable: true,
			className: 'whitespace-nowrap',
			cell: time,
		},
		{
			key: 'tenant',
			header: t('activity.columns.tenant'),
			sortable: true,
			className: 'font-medium',
			cell: (event) =>
				event.tenant ? (
					<Link to={`/platform/tenants/${event.tenant.id}`}>{event.tenant.name}</Link>
				) : (
					t('common.deletedTenant')
				),
		},
		{ key: 'action', header: t('activity.columns.action'), cell: actionLabel },
		{
			key: 'actor',
			header: t('activity.columns.actor'),
			cell: (event) => event.actor ?? t('common.deletedAccount'),
		},
		{
			key: 'details',
			header: t('activity.columns.details'),
			cell: (event) => (
				<button type="button" className="link" onClick={() => setSelected(event)}>
					{t('activity.view')}
				</button>
			),
		},
	];

	return (
		<div className="flex flex-col gap-4">
			<ModulePage title={t('activity.title')} description={t('activity.description')} />
			<AnalyticsCard items={activityStats} />
			<section aria-labelledby="activity-table-title" className="mt-4 flex flex-col gap-4">
				<div>
					<h2 id="activity-table-title" className="font-medium">
						{t('activity.heading')}
					</h2>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{t('activity.subheading')}
					</p>
				</div>
				<Table
					caption={t('activity.caption')}
					columns={columns}
					rows={events}
					getRowKey={(event) => event.id}
					sort={sort}
					onSortChange={setSort}
					search={{
						value: search,
						placeholder: t('activity.search'),
						onChange: setSearch,
					}}
					filter={{
						label: t('activity.columns.action'),
						options: actionFilters.map((value) => ({
							value,
							label: t(`activity.filters.${value}`),
						})),
						value: action,
						onChange: (value) => setAction(value as ActivityFilter),
					}}
					pagination={{
						page,
						pageSize,
						total,
						onPageChange: setPage,
						onPageSizeChange: setPageSize,
					}}
					emptyMessage={isPending ? t('activity.loading') : t('activity.empty')}
				/>
			</section>

			<Dialog
				open={selected !== null}
				onClose={() => setSelected(null)}
				title={selected ? actionLabel(selected) : ''}
				description={selected ? describe(selected) : undefined}
				actions={
					<button type="button" className="btn" onClick={() => setSelected(null)}>
						{t('common.close')}
					</button>
				}
			>
				{selected && (
					<dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
						{[
							{
								label: t('activity.columns.tenant'),
								value: selected.tenant?.name ?? t('common.deletedTenant'),
							},
							{
								label: t('activity.columns.actor'),
								value: selected.actor ?? t('common.deletedAccount'),
							},
							{ label: t('activity.columns.time'), value: time(selected) },
							...(selected.details.reason
								? [
										{
											label: t('activity.columns.reason'),
											value: selected.details.reason,
										},
									]
								: []),
						].map((item) => (
							<div key={item.label} className="min-w-0">
								<dt className="text-[var(--color-slate)]">{item.label}</dt>
								<dd className="mt-1 font-medium break-words">{item.value}</dd>
							</div>
						))}
					</dl>
				)}
			</Dialog>
		</div>
	);
}
