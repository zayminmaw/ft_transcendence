import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnalyticsCard, Avatar, ModulePage, Table, TipCard } from '@global-components';
import type { AnalyticsItem, TableColumn } from '@global-components';
import { useCan } from '@modules/auth';
import { formatNumber } from '@utils/format';
import type { Parcel, ParcelList, ParcelQueue, ParcelStatus } from '../api';
import {
	ASSIGNABLE_STATUSES,
	dispatchStatusLabels,
	parcelStatusLabels,
	vehicleLabel,
} from '../constants';
import { useDispatchDrivers, useParcels } from '../hooks/useParcels';

// Every status but draft, which no parcel has yet, in lifecycle order.
const STATUS_ORDER = (Object.keys(parcelStatusLabels) as ParcelStatus[]).filter(
	(status) => status !== 'draft',
);

// The queues first, then each status, with the company's count where the API gives one.
function queueOptions(counts: ParcelList['counts'] | undefined, language: string) {
	const count = (statuses: ParcelStatus[]) =>
		counts
			? ` · ${formatNumber(
					statuses.reduce((sum, status) => sum + counts.statuses[status], 0),
					language,
				)}`
			: '';
	const options: { value: ParcelQueue; label: string }[] = [
		{ value: 'all', label: 'All parcels' },
		{ value: 'ready', label: `Ready to assign${count(['in_hub_sorted'])}` },
		{
			value: 'exceptions',
			label: `Exceptions${count(['failed_attempt', 'returned_to_sender'])}`,
		},
	];
	for (const status of STATUS_ORDER) {
		options.push({ value: status, label: `${parcelStatusLabels[status]}${count([status])}` });
	}
	return options;
}

// Links are relative to this page (/app/<companySlug>/parcels), so they stay in the open company.
// Sorted parcels are assigned; failed attempts are reassigned for a reattempt.
function ParcelAction({ parcel, canDispatch }: { parcel: Parcel; canDispatch: boolean }) {
	if (canDispatch && ASSIGNABLE_STATUSES.includes(parcel.status)) {
		return (
			<Link to={`assign?parcel=${parcel.id}`}>
				{parcel.status === 'failed_attempt' ? 'Reassign' : 'Assign'}
			</Link>
		);
	}
	return <span aria-label="No action">—</span>;
}

export function DispatchPage() {
	const { i18n } = useTranslation();
	const can = useCan();
	const canDispatch = can('parcels.dispatch');
	const list = useParcels();
	// Who is on duty, with their plates, is for whoever sends parcels out.
	const { dispatchDrivers, isDriversPending } = useDispatchDrivers(canDispatch);
	const statuses = list.counts?.statuses;
	const number = (value: number | undefined) => formatNumber(value, i18n.language);

	const stats: AnalyticsItem[] = [
		{
			label: 'Ready to assign',
			value: number(statuses?.in_hub_sorted),
			description: 'In hub / sorted',
		},
		{
			label: 'Out for delivery',
			value: number(statuses?.out_for_delivery),
			description: `${number(list.counts?.driversOut)} ${list.counts?.driversOut === 1 ? 'driver' : 'drivers'} out`,
		},
		{
			label: 'Failed attempts',
			value: number(statuses?.failed_attempt),
			description: 'Reason captured',
		},
		{
			label: 'Returned to sender',
			value: number(statuses?.returned_to_sender),
			description: 'Back with the merchant',
		},
	];

	const columns: TableColumn<Parcel>[] = [
		{
			key: 'tracking',
			header: 'Tracking / recipient',
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
			header: 'Merchant',
			sortable: true,
			cell: (parcel) => parcel.client.name,
		},
		{
			key: 'zone',
			header: 'Zone / driver',
			cell: (parcel) => `${parcel.deliveryCityZone} · ${parcel.driver?.name ?? 'Unassigned'}`,
		},
		{
			key: 'status',
			header: 'Delivery status',
			cell: (parcel) => parcelStatusLabels[parcel.status],
		},
		{
			key: 'action',
			header: 'Action',
			cell: (parcel) => <ParcelAction parcel={parcel} canDispatch={canDispatch} />,
		},
	];

	return (
		<div className="flex flex-col gap-4">
			<ModulePage
				title="Dispatch & parcels"
				description="Assign ready parcels and resolve delivery exceptions."
				actions={
					(can('parcels.create') || canDispatch) && (
						<div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
							{can('parcels.create') && (
								<Link to="new" className="btn border-0 bg-base-200 md:px-8">
									New parcel
								</Link>
							)}
							{canDispatch && (
								<Link to="assign" className="btn btn-primary md:px-12">
									Assign driver
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
						Parcel queue
					</h2>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{number(statuses?.in_hub_sorted)} parcels are ready for driver assignment
					</p>
				</div>
				<Table
					caption="Parcel queue"
					columns={columns}
					rows={list.parcels}
					getRowKey={(parcel) => parcel.id}
					sort={list.sort}
					onSortChange={list.setSort}
					search={{
						value: list.search,
						placeholder: 'Search tracking, recipient or merchant',
						onChange: list.setSearch,
					}}
					filter={{
						label: 'Queue',
						options: queueOptions(list.counts, i18n.language),
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
					emptyMessage={
						list.isPending ? 'Loading parcels…' : 'No parcels match this search.'
					}
				/>
			</section>

			<div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				{canDispatch && (
					<section
						aria-labelledby="available-drivers-title"
						className="rounded-box bg-base-200 p-6 md:p-8"
					>
						<h2 id="available-drivers-title" className="font-semibold">
							Drivers on duty
						</h2>
						{!isDriversPending && dispatchDrivers.length === 0 && (
							<p className="mt-6 text-sm text-[var(--color-slate)]">
								No driver is on duty. Set a driver available on the drivers page.
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
											{driver.name} · {vehicleLabel(driver.vehicle)}
										</p>
										<p className="mt-1 text-xs text-[var(--color-slate)]">
											{dispatchStatusLabels[driver.dispatchStatus]}
											{driver.zone && ` · ${driver.zone} zone`}
											{driver.run &&
												` · ${driver.run.code} · ${number(driver.run.parcelsOut)} out`}
										</p>
									</div>
								</li>
							))}
						</ul>
					</section>
				)}
				<TipCard
					title="Every parcel has an owner."
					description="Each assignment puts the parcel on the driver's run for the day, with the vehicle they have checked out. Reassignment keeps the delivery history intact."
					footer="Pickup → Hub → Delivery → POD"
				/>
			</div>
		</div>
	);
}
