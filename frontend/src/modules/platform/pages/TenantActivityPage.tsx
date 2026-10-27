import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnalyticsCard, Dialog, ModulePage, Table } from '@global-components';
import type { AnalyticsItem, TableColumn } from '@global-components';
import { formatDate, formatNumber } from '@utils/format';
import type { ActivityDetails, ActivityFilter, TenantActivityEvent } from '../api';
import { useTenantActivity } from '../hooks/useTenantActivity';

const actionFilters = [
	{ value: 'all', label: 'All actions' },
	{ value: 'created', label: 'Tenants created' },
	{ value: 'details', label: 'Details updated' },
	{ value: 'status', label: 'Status changes' },
	{ value: 'administrators', label: 'Administrator changes' },
];

const actionLabels: Record<string, string> = {
	'tenant.create': 'Tenant created',
	'tenant.update': 'Details updated',
	'tenant.suspend': 'Tenant suspended',
	'tenant.reactivate': 'Tenant reactivated',
	'tenant.administrator.assign': 'Administrator assigned',
	'tenant.administrator.revoke': 'Administrator revoked',
};

const fieldLabels: Record<string, string> = {
	name: 'name',
	contactEmail: 'contact email',
	contactPhone: 'contact phone',
	address: 'address',
};

const actionLabel = (event: TenantActivityEvent) => actionLabels[event.action] ?? event.action;
// Role codes (dispatcher, org_admin) as words.
const roleLabel = (code: string) => code.replaceAll('_', ' ');

function listOf(words: string[]) {
	if (words.length <= 1) return words.join('');
	return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

// One sentence on what changed, from the event's details.
function summary({ action, details }: { action: string; details: ActivityDetails }): string {
	const administrator = details.administrator ?? 'An administrator';
	switch (action) {
		case 'tenant.create':
			return details.administrator
				? `Tenant created with first administrator ${details.administrator}.`
				: 'Tenant created.';
		case 'tenant.update': {
			const fields = listOf(
				(details.fields ?? []).map((field) => fieldLabels[field] ?? field),
			);
			return fields ? `Changed the ${fields}.` : 'Tenant details changed.';
		}
		case 'tenant.suspend':
			return details.cause === 'last_administrator_revoked'
				? `Suspended when its last administrator, ${administrator}, was revoked. Records retained.`
				: 'Portal and API access suspended. Records retained.';
		case 'tenant.reactivate':
			return 'Portal and API access restored.';
		case 'tenant.administrator.assign':
			if (details.account === 'new')
				return `New account ${administrator} created as tenant administrator.`;
			return details.previousRole
				? `${administrator} promoted from ${roleLabel(details.previousRole)} to tenant administrator.`
				: `Existing member ${administrator} promoted to tenant administrator.`;
		case 'tenant.administrator.revoke':
			return details.revoke === 'change_role' && details.role
				? `${administrator} moved to the ${roleLabel(details.role)} role.`
				: `${administrator} removed from the company.`;
		default:
			return 'Tenant changed.';
	}
}

export function TenantActivityPage() {
	const { i18n } = useTranslation();
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
			label: 'Events',
			value: formatNumber(counts?.events, i18n.language),
			description: 'In the last 7 days',
		},
		{
			label: 'Status changes',
			value: formatNumber(counts?.status, i18n.language),
			description: 'Suspensions and reactivations, last 7 days',
		},
		{
			label: 'Admin changes',
			value: formatNumber(counts?.administrators, i18n.language),
			description: 'Assignments and revocations, last 7 days',
		},
		{
			label: 'Tenant records',
			value: formatNumber(counts && counts.created + counts.details, i18n.language),
			description: 'Tenants created or edited, last 7 days',
		},
	];

	const columns: TableColumn<TenantActivityEvent>[] = [
		{
			key: 'createdAt',
			header: 'Time',
			sortable: true,
			className: 'whitespace-nowrap',
			cell: time,
		},
		{
			key: 'tenant',
			header: 'Tenant',
			sortable: true,
			className: 'font-medium',
			cell: (event) =>
				event.tenant ? (
					<Link to={`/platform/tenants/${event.tenant.id}`}>{event.tenant.name}</Link>
				) : (
					'Deleted tenant'
				),
		},
		{ key: 'action', header: 'Action', cell: actionLabel },
		{
			key: 'actor',
			header: 'Platform actor',
			cell: (event) => event.actor ?? 'Deleted account',
		},
		{
			key: 'details',
			header: 'Details',
			cell: (event) => (
				<button type="button" className="link" onClick={() => setSelected(event)}>
					View
				</button>
			),
		},
	];

	return (
		<div className="flex flex-col gap-4">
			<ModulePage
				title="Tenant activity"
				description="Tenant status changes and auditable management events."
			/>
			<AnalyticsCard items={activityStats} />
			<section aria-labelledby="activity-table-title" className="mt-4 flex flex-col gap-4">
				<div>
					<h2 id="activity-table-title" className="font-medium">
						Management events
					</h2>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						Who changed which tenant, and when
					</p>
				</div>
				<Table
					caption="Tenant management events"
					columns={columns}
					rows={events}
					getRowKey={(event) => event.id}
					sort={sort}
					onSortChange={setSort}
					search={{
						value: search,
						placeholder: 'Search by tenant or actor',
						onChange: setSearch,
					}}
					filter={{
						label: 'Action',
						options: actionFilters,
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
					emptyMessage={isPending ? 'Loading activity…' : 'No events match this search.'}
				/>
			</section>

			<Dialog
				open={selected !== null}
				onClose={() => setSelected(null)}
				title={selected ? actionLabel(selected) : ''}
				description={selected ? summary(selected) : undefined}
				actions={
					<button type="button" className="btn" onClick={() => setSelected(null)}>
						Close
					</button>
				}
			>
				{selected && (
					<dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
						{[
							{ label: 'Tenant', value: selected.tenant?.name ?? 'Deleted tenant' },
							{ label: 'Platform actor', value: selected.actor ?? 'Deleted account' },
							{ label: 'Time', value: time(selected) },
							...(selected.details.reason
								? [{ label: 'Reason', value: selected.details.reason }]
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
