import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnalyticsCard, ModulePage, Table } from '@global-components';
import type { AnalyticsItem, TableColumn } from '@global-components';
import { formatNumber } from '@utils/format';
import type { TenantListItem, TenantStatusFilter } from '../api';
import { useTenants } from '../hooks/useTenants';

const statusFilters = [
	{ value: 'all', label: 'All tenants' },
	{ value: 'active', label: 'Active' },
	{ value: 'suspended', label: 'Suspended' },
];

const columns: TableColumn<TenantListItem>[] = [
	{
		key: 'name',
		header: 'Organization',
		sortable: true,
		className: 'font-medium',
		cell: (tenant) => (
			<div>
				<p>{tenant.name}</p>
				<p className="text-sm font-normal text-[var(--color-slate)]">{tenant.slug}</p>
			</div>
		),
	},
	{
		key: 'administrator',
		header: 'Tenant administrator',
		cell: (tenant) => tenant.administrator ?? 'None assigned',
	},
	{
		key: 'members',
		header: 'Active members',
		sortable: true,
		cell: (tenant) => tenant.activeMembers,
	},
	{
		key: 'status',
		header: 'Access status',
		cell: (tenant) => (tenant.isActive ? 'Active' : 'Suspended'),
	},
	{
		key: 'action',
		header: 'Action',
		cell: (tenant) => <Link to={`/platform/tenants/${tenant.id}`}>Manage</Link>,
	},
];

export function TenantsPage() {
	const { i18n } = useTranslation();
	const {
		tenants,
		total,
		counts,
		isPending,
		search,
		setSearch,
		status,
		setStatus,
		sort,
		setSort,
		page,
		setPage,
		pageSize,
		setPageSize,
	} = useTenants();

	const tenantStats: AnalyticsItem[] = [
		{
			label: 'Total tenants',
			value: formatNumber(counts?.total, i18n.language),
			description: 'Organization records',
		},
		{
			label: 'Active',
			value: formatNumber(counts?.active, i18n.language),
			description: 'Portal access enabled',
		},
		{
			label: 'Suspended',
			value: formatNumber(counts?.suspended, i18n.language),
			description: 'History retained',
		},
		{
			label: 'Members',
			value: formatNumber(counts?.members, i18n.language),
			description: 'People with portal access',
		},
	];

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
					onSortChange={setSort}
					search={{
						value: search,
						placeholder: 'Search by name or slug',
						onChange: setSearch,
					}}
					filter={{
						label: 'Access status',
						options: statusFilters,
						value: status,
						onChange: (value) => setStatus(value as TenantStatusFilter),
					}}
					pagination={{
						page,
						pageSize,
						total,
						onPageChange: setPage,
						onPageSizeChange: setPageSize,
					}}
					emptyMessage={isPending ? 'Loading tenants…' : 'No tenants match this search.'}
				/>
			</section>
		</div>
	);
}
