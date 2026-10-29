import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AnalyticsCard, ExpiryDate, ModulePage, Table, TipCard } from '@global-components';
import type { AnalyticsItem, TableColumn } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { useCan, useCurrentWorkspace } from '@modules/auth';
import { formatNumber } from '@utils/format';
import type { Asset, AssetStatusFilter } from '../api';
import { ConditionBadge } from '../components/ConditionBadge';
import { ASSET_STATUSES } from '../constants';
import { useAssets } from '../hooks/useAssets';

// Fleet & assets: the company's vehicles and equipment, and who has them, for anyone with assets.view.
export function AssetsPage() {
	const { t, i18n } = useTranslation('assets');
	const companyPath = useCompanyPath();
	const company = useCurrentWorkspace()?.name ?? '';
	const can = useCan();
	const {
		assets,
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
	} = useAssets();
	const count = (value?: number) => formatNumber(value, i18n.language);
	const none = t('details.none');
	let emptyMessage = t('table.empty');
	if (isPending) emptyMessage = t('page.loading');
	else if (search.trim() || status !== 'all') emptyMessage = t('table.noMatch');

	const assetStats: AnalyticsItem[] = [
		{
			label: t('tiles.inService'),
			value: count(counts?.inService),
			description: t('tiles.inServiceNote', { n: count(counts?.decommissioned) }),
		},
		{
			label: t('tiles.checkedOut'),
			value: count(counts?.checkedOut),
			description: t('tiles.checkedOutNote'),
		},
		{
			label: t('tiles.needsMaintenance'),
			value: count(counts?.needsMaintenance),
			description: t('tiles.needsMaintenanceNote'),
		},
		{
			label: t('tiles.roadTax'),
			value: count(counts?.roadTaxDue),
			description: t('tiles.roadTaxNote'),
		},
	];

	const columns: TableColumn<Asset>[] = [
		{
			key: 'assetName',
			header: t('table.asset'),
			sortable: true,
			cell: (asset) => (
				<div>
					<Link
						to={companyPath(`assets/${asset.id}`)}
						className="link link-hover font-medium"
					>
						{asset.assetName}
					</Link>
					<p className="text-xs text-[var(--color-slate)]">{asset.assetTag}</p>
				</div>
			),
		},
		{
			key: 'category',
			header: t('table.category'),
			cell: (asset) => t(`category.${asset.category}`),
		},
		{
			key: 'plate',
			header: t('table.plate'),
			cell: (asset) => (
				<span dir="ltr" className="whitespace-nowrap">
					{asset.licensePlate ?? none}
				</span>
			),
		},
		{
			key: 'holder',
			header: t('table.holder'),
			cell: (asset) => asset.holder?.driverName ?? t('table.inDepot'),
		},
		{
			key: 'condition',
			header: t('table.condition'),
			cell: (asset) => <ConditionBadge condition={asset.currentCondition} />,
		},
		{
			key: 'roadTax',
			header: t('table.roadTax'),
			cell: (asset) =>
				asset.roadTaxExpiry && asset.currentCondition !== 'decommissioned' ? (
					<ExpiryDate date={asset.roadTaxExpiry} />
				) : (
					none
				),
		},
	];

	return (
		<div className="flex flex-col gap-6">
			<ModulePage
				title={t('page.title')}
				description={t('page.description', { company })}
				actions={
					can('assets.create') && (
						<Link to={companyPath('assets/new')} className="btn btn-primary md:px-8">
							{t('page.create')}
						</Link>
					)
				}
			/>
			<AnalyticsCard items={assetStats} />
			<section className="flex flex-col gap-4">
				<div>
					<h2 className="font-semibold">{t('table.title')}</h2>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{t('table.description')}
					</p>
				</div>
				<Table
					caption={t('table.title')}
					columns={columns}
					rows={assets}
					getRowKey={(asset) => asset.id}
					sort={sort}
					onSortChange={setSort}
					search={{ value: search, onChange: setSearch, placeholder: t('table.search') }}
					filter={{
						label: t('table.statusFilter'),
						value: status,
						onChange: (value) => setStatus(value as AssetStatusFilter),
						options: [
							{ value: 'all', label: t('table.allStatuses') },
							...ASSET_STATUSES.map((value) => ({
								value,
								label: t(`status.${value}`),
							})),
						],
					}}
					pagination={{
						page,
						pageSize,
						total,
						onPageChange: setPage,
						onPageSizeChange: setPageSize,
					}}
					emptyMessage={emptyMessage}
				/>
			</section>
			<TipCard title={t('tip.title')} description={t('tip.description')} />
		</div>
	);
}
