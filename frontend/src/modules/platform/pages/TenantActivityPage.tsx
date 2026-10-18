import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnalyticsCard, Dialog, ModulePage, Table } from '@global-components';
import type { AnalyticsItem, TableColumn, TableSort } from '@global-components';
import { tenantActivity } from '../data/sampleActivity';
import type { TenantActivity } from '../data/sampleActivity';

// Sample data until the tenant activity endpoint exists.
const activityStats: AnalyticsItem[] = [
	{ label: 'Events', value: 5, description: 'In the last 7 days' },
	{ label: 'Status changes', value: 1, description: 'Suspensions and reactivations' },
	{ label: 'Admin changes', value: 2, description: 'Assignments and revocations' },
	{ label: 'Failed', value: 1, description: 'Rejected or rolled back' },
];

const actionFilters = [
	{ value: 'all', label: 'All actions' },
	{ value: 'status', label: 'Status changes' },
	{ value: 'administrators', label: 'Administrator changes' },
	{ value: 'details', label: 'Details updated' },
];

export function TenantActivityPage() {
	const [search, setSearch] = useState('');
	const [action, setAction] = useState('all');
	const [sort, setSort] = useState<TableSort | null>(null);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [selected, setSelected] = useState<TenantActivity | null>(null);

	const columns: TableColumn<TenantActivity>[] = [
		{
			key: 'time',
			header: 'Time',
			sortable: true,
			className: 'whitespace-nowrap',
			cell: (event) => event.time,
		},
		{
			key: 'tenant',
			header: 'Tenant',
			sortable: true,
			className: 'font-medium',
			cell: (event) => <Link to={`/platform/tenants/${event.tenantId}`}>{event.tenant}</Link>,
		},
		{ key: 'action', header: 'Action', cell: (event) => event.action },
		{ key: 'actor', header: 'Platform actor', cell: (event) => event.actor },
		{
			key: 'outcome',
			header: 'Outcome',
			cell: (event) => (event.outcome === 'success' ? 'Success' : 'Failed'),
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
						Who changed which tenant, and whether it succeeded
					</p>
				</div>
				<Table
					caption="Tenant management events"
					columns={columns}
					rows={tenantActivity}
					getRowKey={(event) => event.id}
					sort={sort}
					onSortChange={(next) => {
						setSort(next);
						setPage(1);
					}}
					search={{
						value: search,
						placeholder: 'Search events',
						onChange: (value) => {
							setSearch(value);
							setPage(1);
						},
					}}
					filter={{
						label: 'Action',
						options: actionFilters,
						value: action,
						onChange: (value) => {
							setAction(value);
							setPage(1);
						},
					}}
					pagination={{
						page,
						pageSize,
						total: tenantActivity.length,
						onPageChange: setPage,
						onPageSizeChange: (size) => {
							setPageSize(size);
							setPage(1);
						},
					}}
					emptyMessage="No events match this search."
				/>
			</section>

			<Dialog
				open={selected !== null}
				onClose={() => setSelected(null)}
				title={selected?.action ?? ''}
				description={selected?.summary}
				actions={
					<button type="button" className="btn" onClick={() => setSelected(null)}>
						Close
					</button>
				}
			>
				{selected && (
					<dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
						{[
							{ label: 'Tenant', value: selected.tenant },
							{ label: 'Platform actor', value: selected.actor },
							{ label: 'Time', value: selected.time },
							{
								label: 'Outcome',
								value: selected.outcome === 'success' ? 'Success' : 'Failed',
							},
						].map((item) => (
							<div key={item.label}>
								<dt className="text-[var(--color-slate)]">{item.label}</dt>
								<dd className="mt-1 font-medium">{item.value}</dd>
							</div>
						))}
					</dl>
				)}
			</Dialog>
		</div>
	);
}
