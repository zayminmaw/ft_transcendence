import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AnalyticsCard, ExpiryDate, ModulePage, Table, TipCard } from '@global-components';
import type { AnalyticsItem, TableColumn } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { useCan, useCurrentWorkspace } from '@modules/auth';
import { formatNumber } from '@utils/format';
import type { Driver, DriverStatusFilter } from '../api';
import { DutyStatusBadge } from '../components/DutyStatusBadge';
import { DISPATCH_STATUSES } from '../constants';
import { useDrivers } from '../hooks/useDrivers';

// Drivers: the company's couriers for anyone with drivers.view; license dates with drivers.view_compliance.
export function DriversPage() {
	const { t, i18n } = useTranslation('drivers');
	const companyPath = useCompanyPath();
	const company = useCurrentWorkspace()?.name ?? '';
	const can = useCan();
	const withCompliance = can('drivers.view_compliance');
	const {
		drivers,
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
	} = useDrivers();
	const count = (value?: number) => formatNumber(value, i18n.language);
	let emptyMessage = t('table.empty');
	if (isPending) emptyMessage = t('page.loading');
	else if (search.trim() || status !== 'all') emptyMessage = t('table.noMatch');

	const driverStats: AnalyticsItem[] = [
		{
			label: t('tiles.available'),
			value: count(counts?.available),
			description: t('tiles.availableNote', { n: count(counts?.total) }),
		},
		{
			label: t('tiles.onRun'),
			value: count(counts?.onRun),
			description: t('tiles.onRunNote'),
		},
		{
			label: t('tiles.offDuty'),
			value: count(counts?.offDuty),
			description: t('tiles.suspended', { n: count(counts?.suspended) }),
		},
		withCompliance
			? {
					label: t('tiles.licenses'),
					value: count(counts?.licensesExpiring),
					description: t('tiles.licensesNote'),
				}
			: {
					label: t('tiles.total'),
					value: count(counts?.total),
					description: t('tiles.totalNote'),
				},
	];

	const columns: TableColumn<Driver>[] = [
		{
			key: 'lastName',
			header: t('table.driver'),
			sortable: true,
			cell: (driver) => (
				<div>
					<Link
						to={companyPath(`drivers/${driver.id}`)}
						className="link link-hover font-medium"
					>
						{driver.firstName} {driver.lastName}
					</Link>
					<p className="text-xs text-[var(--color-slate)]">{driver.employeeCode}</p>
				</div>
			),
		},
		{
			key: 'mobile',
			header: t('table.mobile'),
			cell: (driver) => (
				<span dir="ltr" className="whitespace-nowrap">
					{driver.personalMobile}
				</span>
			),
		},
		{
			key: 'vehicle',
			header: t('table.vehicle'),
			cell: (driver) => (
				<div>
					<p>{t(`category.${driver.driverCategory}`)}</p>
					<p className="text-xs text-[var(--color-slate)]">
						{t(`fleet.${driver.fleetArrangement}`)}
					</p>
				</div>
			),
		},
		{
			key: 'zone',
			header: t('table.zone'),
			cell: (driver) => driver.assignedZone ?? t('details.none'),
		},
		{
			key: 'status',
			header: t('table.status'),
			cell: (driver) => <DutyStatusBadge status={driver.dispatchStatus} />,
		},
	];
	if (withCompliance)
		columns.push({
			key: 'license',
			header: t('table.license'),
			cell: (driver) =>
				driver.licenseExpiryDate ? <ExpiryDate date={driver.licenseExpiryDate} /> : null,
		});

	return (
		<div className="flex flex-col gap-6">
			<ModulePage
				title={t('page.title')}
				description={t('page.description', { company })}
				actions={
					can('drivers.manage') && (
						<Link to={companyPath('drivers/new')} className="btn btn-primary md:px-8">
							{t('page.create')}
						</Link>
					)
				}
			/>
			<AnalyticsCard items={driverStats} />
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
					rows={drivers}
					getRowKey={(driver) => driver.id}
					sort={sort}
					onSortChange={setSort}
					search={{ value: search, onChange: setSearch, placeholder: t('table.search') }}
					filter={{
						label: t('table.statusFilter'),
						value: status,
						onChange: (value) => setStatus(value as DriverStatusFilter),
						options: [
							{ value: 'all', label: t('table.allStatuses') },
							...DISPATCH_STATUSES.map((value) => ({
								value,
								label: t(`dispatchStatus.${value}`),
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
