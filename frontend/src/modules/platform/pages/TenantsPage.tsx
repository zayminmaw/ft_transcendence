import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnalyticsCard, Table } from '@global-components';
import type { AnalyticsItem, TableColumn, TableSort } from '@global-components';

type Tenant = {
	id: string;
	organization: string;
	administrator: string;
	members: number;
	status: 'active' | 'suspended';
};

// Sample data until the tenant endpoints exist.
const tenantStats: AnalyticsItem[] = [
	{ label: 'Total tenants', value: 24, description: 'Organization records' },
	{ label: 'Active', value: 21, description: 'Portal access enabled' },
	{ label: 'Suspended', value: 3, description: 'History retained' },
	{ label: 'Admin changes', value: 6, description: 'In the last 7 days' },
];

const tenants: Tenant[] = [
	{
		id: '1',
		organization: 'Meridian Courier',
		administrator: 'Lina Haddad',
		members: 84,
		status: 'active',
	},
	{
		id: '2',
		organization: 'Northline Logistics',
		administrator: 'Omar Nasser',
		members: 52,
		status: 'active',
	},
	{
		id: '3',
		organization: 'Relay Express',
		administrator: 'Dana Saleh',
		members: 38,
		status: 'active',
	},
	{
		id: '4',
		organization: 'Atlas Dispatch',
		administrator: 'Karim Ali',
		members: 19,
		status: 'suspended',
	},
	{
		id: '5',
		organization: 'Parcel Works',
		administrator: 'Nour Khalil',
		members: 27,
		status: 'active',
	},
	{
		id: '6',
		organization: 'Urban Route',
		administrator: 'Rami Hasan',
		members: 16,
		status: 'suspended',
	},
	{
		id: '7',
		organization: 'Harbor Freight Co',
		administrator: 'Maya Farah',
		members: 61,
		status: 'active',
	},
	{
		id: '8',
		organization: 'Summit Haulage',
		administrator: 'Tariq Aziz',
		members: 44,
		status: 'active',
	},
	{
		id: '9',
		organization: 'Bluebird Delivery',
		administrator: 'Sara Mansour',
		members: 33,
		status: 'active',
	},
	{
		id: '10',
		organization: 'Cedar Line Cargo',
		administrator: 'Yousef Darwish',
		members: 12,
		status: 'active',
	},
	{
		id: '11',
		organization: 'Pioneer Post',
		administrator: 'Hala Younes',
		members: 29,
		status: 'active',
	},
	{
		id: '12',
		organization: 'Ironbridge Transport',
		administrator: 'Fadi Karam',
		members: 73,
		status: 'active',
	},
	{
		id: '13',
		organization: 'Lantern Logistics',
		administrator: 'Rana Sabbagh',
		members: 21,
		status: 'active',
	},
	{
		id: '14',
		organization: 'Quickstep Couriers',
		administrator: 'Samir Odeh',
		members: 9,
		status: 'suspended',
	},
	{
		id: '15',
		organization: 'Delta Parcel',
		administrator: 'Layla Nassar',
		members: 47,
		status: 'active',
	},
	{
		id: '16',
		organization: 'Greenway Dispatch',
		administrator: 'Bashar Hamdan',
		members: 35,
		status: 'active',
	},
	{
		id: '17',
		organization: 'Orbit Shipping',
		administrator: 'Dina Rahal',
		members: 58,
		status: 'active',
	},
	{
		id: '18',
		organization: 'Kestrel Express',
		administrator: 'Ziad Barakat',
		members: 24,
		status: 'active',
	},
	{
		id: '19',
		organization: 'Milestone Movers',
		administrator: 'Huda Saad',
		members: 18,
		status: 'active',
	},
	{
		id: '20',
		organization: 'Tidewater Freight',
		administrator: 'Nabil Shami',
		members: 66,
		status: 'active',
	},
	{
		id: '21',
		organization: 'Vector Courier',
		administrator: 'Rima Tannous',
		members: 31,
		status: 'active',
	},
	{
		id: '22',
		organization: 'Juniper Cargo',
		administrator: 'Adel Mourad',
		members: 14,
		status: 'active',
	},
	{
		id: '23',
		organization: 'Eastgate Delivery',
		administrator: 'Mona Habib',
		members: 40,
		status: 'active',
	},
	{
		id: '24',
		organization: 'Foxtrot Logistics',
		administrator: 'Walid Jaber',
		members: 26,
		status: 'active',
	},
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
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h1
						id="workspace-page-title"
						className="workspace-title text-[2rem] md:text-[2.5rem]"
					>
						Tenant administration
					</h1>
					<p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--color-slate)]">
						Organization access, tenant ownership, and management activity.
					</p>
				</div>
				<Link
					to="/platform/tenants/new"
					className="btn btn-primary w-full md:w-auto md:px-12"
				>
					Create tenant
				</Link>
			</div>
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
