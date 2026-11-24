import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnalyticsCard, ModulePage, Table } from '@global-components';
import type { AnalyticsItem, TableColumn } from '@global-components';
import { formatNumber } from '@utils/format';
import type { TenantListItem, TenantStatusFilter } from '../api';
import { useTenants } from '../hooks/useTenants';

export function TenantsPage() {
	const { t, i18n } = useTranslation('platform');
	const statusFilters = (['all', 'active', 'suspended'] as const).map((value) => ({
		value,
		label: t(`tenants.filters.${value}`),
	}));

	const columns: TableColumn<TenantListItem>[] = [
		{
			key: 'name',
			header: t('tenants.columns.organization'),
			sortable: true,
			className: 'font-medium',
			cell: (tenant) => (
				<div>
					<p>{tenant.name}</p>
					<p className="text-sm font-normal text-[var(--color-slate)]">
						<span dir="ltr">{tenant.slug}</span>
					</p>
				</div>
			),
		},
		{
			key: 'administrator',
			header: t('tenants.columns.administrator'),
			cell: (tenant) => tenant.administrator ?? t('tenants.noAdministrator'),
		},
		{
			key: 'members',
			header: t('tenants.columns.members'),
			sortable: true,
			cell: (tenant) => tenant.activeMembers,
		},
		{
			key: 'status',
			header: t('tenants.columns.status'),
			cell: (tenant) => (tenant.isActive ? t('common.active') : t('common.suspended')),
		},
		{
			key: 'action',
			header: t('tenants.columns.action'),
			cell: (tenant) => (
				<Link to={`/platform/tenants/${tenant.id}`}>{t('tenants.manage')}</Link>
			),
		},
	];
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
			label: t('tenants.stats.total'),
			value: formatNumber(counts?.total, i18n.language),
			description: t('tenants.stats.totalNote'),
		},
		{
			label: t('tenants.stats.active'),
			value: formatNumber(counts?.active, i18n.language),
			description: t('tenants.stats.activeNote'),
		},
		{
			label: t('tenants.stats.suspended'),
			value: formatNumber(counts?.suspended, i18n.language),
			description: t('tenants.stats.suspendedNote'),
		},
		{
			label: t('tenants.stats.members'),
			value: formatNumber(counts?.members, i18n.language),
			description: t('tenants.stats.membersNote'),
		},
	];

	return (
		<div className="flex flex-col gap-4">
			<ModulePage
				title={t('tenants.title')}
				description={t('tenants.description')}
				actions={
					<Link
						to="/platform/tenants/new"
						className="btn btn-primary w-full md:w-auto md:px-12"
					>
						{t('tenants.create')}
					</Link>
				}
			/>
			<AnalyticsCard items={tenantStats} />
			<section aria-labelledby="tenants-table-title" className="mt-4 flex flex-col gap-4">
				<div>
					<h2 id="tenants-table-title" className="font-medium">
						{t('tenants.heading')}
					</h2>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{t('tenants.subheading')}
					</p>
				</div>
				<Table
					caption={t('tenants.heading')}
					columns={columns}
					rows={tenants}
					getRowKey={(tenant) => tenant.id}
					sort={sort}
					onSortChange={setSort}
					search={{
						value: search,
						placeholder: t('tenants.search'),
						onChange: setSearch,
					}}
					filter={{
						label: t('tenants.columns.status'),
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
					emptyMessage={isPending ? t('tenants.loading') : t('tenants.empty')}
				/>
			</section>
		</div>
	);
}
