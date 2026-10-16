import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnalyticsCard, ModulePage, Table } from '@global-components';
import type { AnalyticsItem, TableColumn, TableSort } from '@global-components';
import { tenants } from '../data/sampleTenants';
import type { Tenant } from '../data/sampleTenants';

// Sample data until the tenant endpoints exist.
const tenantStats: AnalyticsItem[] = [
	{ label: 'Total tenants', value: 24, description: 'Organization records' },
	{ label: 'Active', value: 21, description: 'Portal access enabled' },
	{ label: 'Suspended', value: 3, description: 'History retained' },
	{ label: 'Admin changes', value: 6, description: 'In the last 7 days' },
];

const countByStatus = (status: Tenant['status']) =>
	tenants.filter((tenant) => tenant.status === status).length;

const statusFilters = [
	{ value: 'all', label: `All tenants · ${tenants.length}` },
	{ value: 'active', label: `Active · ${countByStatus('active')}` },
	{ value: 'suspended', label: `Suspended · ${countByStatus('suspended')}` },
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

// Stands in for the server: search, filter, sort, and pagination will move to the tenant endpoint.
function queryTenants(
	search: string,
	status: string,
	sort: TableSort | null,
	page: number,
	pageSize: number,
) {
	const term = search.trim().toLowerCase();
	const matches = tenants.filter(
		(tenant) =>
			(status === 'all' || tenant.status === status) &&
			`${tenant.organization} ${tenant.administrator}`.toLowerCase().includes(term),
	);
	if (sort) {
		const key = sort.key as 'organization' | 'administrator' | 'members';
		const order = sort.direction === 'asc' ? 1 : -1;
		matches.sort((a, b) => (a[key] < b[key] ? -order : a[key] > b[key] ? order : 0));
	}
	return {
		rows: matches.slice((page - 1) * pageSize, page * pageSize),
		total: matches.length,
	};
}

export function TenantsPage() {
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState('all');
	const [sort, setSort] = useState<TableSort | null>(null);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const { rows, total } = queryTenants(search, status, sort, page, pageSize);

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
					rows={rows}
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
						total,
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
