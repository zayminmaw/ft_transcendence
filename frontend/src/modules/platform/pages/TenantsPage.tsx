import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnalyticsCard, ModulePage, Table } from '@global-components';
import type { AnalyticsItem, TableColumn, TableSort } from '@global-components';
import { tenants } from '../data/sampleTenants';
import type { Tenant } from '../data/sampleTenants';

// Sample data until the tenant endpoints exist.
const tenantStats: AnalyticsItem[] = [
	{ label: 'Total tenants', value: 5, description: 'Organization records' },
	{ label: 'Active', value: 4, description: 'Portal access enabled' },
	{ label: 'Suspended', value: 1, description: 'History retained' },
	{ label: 'Admin changes', value: 6, description: 'In the last 7 days' },
];

const statusFilters = [
	{ value: 'all', label: 'All tenants' },
	{ value: 'active', label: 'Active' },
	{ value: 'suspended', label: 'Suspended' },
];

const columns: TableColumn<Tenant>[] = [
	{
		key: 'organization',
		header: 'Organization',
		sortable: true,
		className: 'font-medium',
		cell: (tenant) => tenant.organization,
	},
	{
		key: 'administrator',
		header: 'Tenant administrator',
		sortable: true,
		cell: (tenant) => tenant.administrator,
	},
	{
		key: 'members',
		header: 'Memberships',
		sortable: true,
		cell: (tenant) => `${tenant.members} members`,
	},
	{
		key: 'status',
		header: 'Access status',
		cell: (tenant) => (tenant.status === 'active' ? 'Active' : 'Suspended'),
	},
	{
		key: 'action',
		header: 'Action',
		cell: (tenant) => <Link to={`/platform/tenants/${tenant.id}`}>Manage</Link>,
	},
];

export function TenantsPage() {
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState('all');
	const [sort, setSort] = useState<TableSort | null>(null);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);

	return (
		<div className="flex flex-col gap-4">
			<ModulePage
				title="Tenant administration"
				description="Organization access, tenant ownership, and management activity."
				actions={
					<Link
						to="/platform/tenants/new"
						className="btn btn-primary w-full md:w-auto md:px-12"
					>
						Create tenant
					</Link>
				}
			/>
			<AnalyticsCard items={tenantStats} />
			<section aria-labelledby="tenants-table-title" className="mt-4 flex flex-col gap-4">
				<div>
					<h2 id="tenants-table-title" className="font-medium">
						Tenants
					</h2>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						Organizations using Transcend
					</p>
				</div>
				<Table
					caption="Tenants"
					columns={columns}
					rows={tenants}
					getRowKey={(tenant) => tenant.id}
					sort={sort}
					onSortChange={(next) => {
						setSort(next);
						setPage(1);
					}}
					search={{
						value: search,
						placeholder: 'Search tenants',
						onChange: (value) => {
							setSearch(value);
							setPage(1);
						},
					}}
					filter={{
						label: 'Access status',
						options: statusFilters,
						value: status,
						onChange: (value) => {
							setStatus(value);
							setPage(1);
						},
					}}
					pagination={{
						page,
						pageSize,
						total: tenants.length,
						onPageChange: setPage,
						onPageSizeChange: (size) => {
							setPageSize(size);
							setPage(1);
						},
					}}
					emptyMessage="No tenants match this search."
				/>
			</section>
		</div>
	);
}
