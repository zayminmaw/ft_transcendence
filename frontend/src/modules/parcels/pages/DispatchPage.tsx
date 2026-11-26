import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnalyticsCard, Avatar, ModulePage, Table, TipCard } from '@global-components';
import type { TFunction } from 'i18next';
import type { AnalyticsItem, TableColumn } from '@global-components';
import { useCan } from '@modules/auth';
import { formatNumber } from '@utils/format';
import type { Parcel, ParcelList, ParcelQueue, ParcelStatus } from '../api';
import { ASSIGNABLE_STATUSES, PARCEL_STATUSES, vehicleLabel } from '../constants';
import { useDispatchDrivers, useParcels } from '../hooks/useParcels';

// Every status but draft, which no parcel has yet, in lifecycle order.
const STATUS_ORDER = PARCEL_STATUSES.filter((status) => status !== 'draft');

// The queues first, then each status, with the company's count where the API gives one.
function queueOptions(
	t: TFunction<'parcels'>,
	counts: ParcelList['counts'] | undefined,
	language: string,
) {
	const count = (statuses: ParcelStatus[]) =>
		counts
			? ` · ${formatNumber(
					statuses.reduce((sum, status) => sum + counts.statuses[status], 0),
					language,
				)}`
			: '';
	const options: { value: ParcelQueue; label: string }[] = [
		{ value: 'all', label: t('dispatch.filters.all') },
		{ value: 'ready', label: `${t('dispatch.filters.ready')}${count(['in_hub_sorted'])}` },
		{
			value: 'exceptions',
			label: `${t('dispatch.filters.exceptions')}${count(['failed_attempt', 'returned_to_sender'])}`,
		},
	];
	for (const status of STATUS_ORDER) {
		options.push({ value: status, label: `${t(`status.${status}`)}${count([status])}` });
	}
	return options;
}

// Links are relative to this page (/app/<companySlug>/parcels), so they stay in the open company.
// Sorted parcels are assigned; failed attempts are reassigned for a reattempt.
function ParcelAction({ parcel, canDispatch }: { parcel: Parcel; canDispatch: boolean }) {
	const { t } = useTranslation('parcels');
	if (canDispatch && ASSIGNABLE_STATUSES.includes(parcel.status)) {
		return (
			<Link to={`assign?parcel=${parcel.id}`}>
				{parcel.status === 'failed_attempt' ? t('dispatch.reassign') : t('dispatch.assign')}
			</Link>
		);
	}
	return <span aria-label={t('dispatch.noAction')}>—</span>;
}

export function DispatchPage() {
	const { t, i18n } = useTranslation('parcels');
	const can = useCan();
	const canDispatch = can('parcels.dispatch');
	const list = useParcels();
	// Who is on duty, with their plates, is for whoever sends parcels out.
	const { dispatchDrivers, isDriversPending } = useDispatchDrivers(canDispatch);
	const statuses = list.counts?.statuses;
	const number = (value: number | undefined) => formatNumber(value, i18n.language);

	const stats: AnalyticsItem[] = [
		{
			label: t('dispatch.stats.ready'),
			value: number(statuses?.in_hub_sorted),
			description: t('status.in_hub_sorted'),
		},
		{
			label: t('dispatch.stats.out'),
			value: number(statuses?.out_for_delivery),
			description: t('dispatch.stats.driversOut', { count: list.counts?.driversOut ?? 0 }),
		},
		{
			label: t('dispatch.stats.failed'),
			value: number(statuses?.failed_attempt),
			description: t('dispatch.stats.failedNote'),
		},
		{
			label: t('dispatch.stats.returned'),
			value: number(statuses?.returned_to_sender),
			description: t('dispatch.stats.returnedNote'),
		},
	];

	const columns: TableColumn<Parcel>[] = [
		{
			key: 'tracking',
			header: t('dispatch.columns.tracking'),
			sortable: true,
			className: 'font-medium whitespace-nowrap',
			cell: (parcel) => (
				<Link to={parcel.id}>
					{parcel.trackingNumber} · {parcel.recipientName}
				</Link>
			),
		},
		{
			key: 'merchant',
			header: t('dispatch.columns.merchant'),
			sortable: true,
			cell: (parcel) => <bdi>{parcel.client.name}</bdi>,
		},
		{
			key: 'zone',
			header: t('dispatch.columns.zone'),
			cell: (parcel) =>
				`${parcel.deliveryCityZone} · ${parcel.driver?.name ?? t('common.unassigned')}`,
		},
		{
			key: 'status',
			header: t('dispatch.columns.status'),
			cell: (parcel) => t(`status.${parcel.status}`),
		},
		{
			key: 'action',
			header: t('dispatch.columns.action'),
			cell: (parcel) => <ParcelAction parcel={parcel} canDispatch={canDispatch} />,
		},
	];

	return (
		<div className="flex flex-col gap-4">
			<ModulePage
				title={t('dispatch.title')}
				description={t('dispatch.description')}
				actions={
					(can('parcels.create') || canDispatch) && (
						<div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
							{can('parcels.create') && (
								<Link to="new" className="btn border-0 bg-base-200 md:px-8">
									{t('dispatch.newParcel')}
								</Link>
							)}
							{canDispatch && (
								<Link to="assign" className="btn btn-primary md:px-12">
									{t('dispatch.assignDriver')}
								</Link>
							)}
						</div>
					)
				}
			/>
			<AnalyticsCard items={stats} />
			<section aria-labelledby="parcel-queue-title" className="mt-4 flex flex-col gap-4">
				<div>
					<h2 id="parcel-queue-title" className="font-medium">
						{t('dispatch.queue')}
					</h2>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{t('dispatch.readyCount', { parcels: number(statuses?.in_hub_sorted) })}
					</p>
				</div>
				<Table
					caption={t('dispatch.queue')}
					columns={columns}
					rows={list.parcels}
					getRowKey={(parcel) => parcel.id}
					sort={list.sort}
					onSortChange={list.setSort}
					search={{
						value: list.search,
						placeholder: t('dispatch.search'),
						onChange: list.setSearch,
					}}
					filter={{
						label: t('dispatch.queueFilter'),
						options: queueOptions(t, list.counts, i18n.language),
						value: list.queue,
						onChange: (value) => list.setQueue(value as ParcelQueue),
					}}
					pagination={{
						page: list.page,
						pageSize: list.pageSize,
						total: list.total,
						onPageChange: list.setPage,
						onPageSizeChange: list.setPageSize,
					}}
					emptyMessage={list.isPending ? t('dispatch.loading') : t('dispatch.empty')}
				/>
			</section>

			<div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				{canDispatch && (
					<section
						aria-labelledby="available-drivers-title"
						className="rounded-box bg-base-200 p-6 md:p-8"
					>
						<h2 id="available-drivers-title" className="font-semibold">
							{t('dispatch.driversOnDuty')}
						</h2>
						{!isDriversPending && dispatchDrivers.length === 0 && (
							<p className="mt-6 text-sm text-[var(--color-slate)]">
								{t('common.noDriverOnDuty')}
							</p>
						)}
						<ul className="mt-6 flex flex-col gap-5">
							{dispatchDrivers.map((driver) => (
								<li
									key={driver.id}
									className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2"
								>
									<Avatar name={driver.name} seed={driver.id} />
									<div>
										<p className="font-medium">
											{driver.name} · {vehicleLabel(t, driver.vehicle)}
										</p>
										<p className="mt-1 text-xs text-[var(--color-slate)]">
											{t(`dispatchStatus.${driver.dispatchStatus}`)}
											{driver.zone &&
												` · ${t('common.zone', { zone: driver.zone })}`}
											{driver.run &&
												` · ${t('dispatch.runOut', { code: driver.run.code, parcels: number(driver.run.parcelsOut) })}`}
										</p>
									</div>
								</li>
							))}
						</ul>
					</section>
				)}
				<TipCard
					title={t('dispatch.tipTitle')}
					description={t('dispatch.tipText')}
					footer={t('dispatch.tipFooter')}
				/>
			</div>
		</div>
	);
}
