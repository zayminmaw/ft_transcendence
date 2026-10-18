import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnalyticsCard, ModulePage, Table, TipCard } from '@global-components';
import type { AnalyticsItem, TableColumn, TableSort } from '@global-components';
import {
	driverStatusLabels,
	drivers,
	findDriver,
	parcelStatusLabels,
	parcels,
} from '../data/sampleParcels';
import type { Parcel } from '../data/sampleParcels';

// Sample data until the parcel endpoints exist.
const dispatchStats: AnalyticsItem[] = [
	{ label: 'Ready to assign', value: 24, description: 'In hub / sorted' },
	{ label: 'Out for delivery', value: 96, description: '12 assigned drivers' },
	{ label: 'Failed attempts', value: 8, description: 'Reason captured' },
	{ label: 'Returned to sender', value: 4, description: 'Awaiting return review' },
];

const queueFilters = [
	{ value: 'all', label: 'All parcels' },
	{ value: 'ready', label: 'Ready to assign · 24' },
	{ value: 'exceptions', label: 'Exceptions · 12' },
];

// Sorted parcels without a driver are assigned; failed attempts are reassigned for a reattempt.
function ParcelAction({ parcel }: { parcel: Parcel }) {
	if (parcel.status === 'in_hub_sorted' && !parcel.driverId) {
		return <Link to={`/app/parcels/assign?parcel=${parcel.id}`}>Assign</Link>;
	}
	if (parcel.status === 'failed_attempt') {
		return <Link to={`/app/parcels/assign?parcel=${parcel.id}`}>Reassign</Link>;
	}
	return <span aria-label="No action">—</span>;
}

const columns: TableColumn<Parcel>[] = [
	{
		key: 'tracking',
		header: 'Tracking / recipient',
		sortable: true,
		className: 'font-medium whitespace-nowrap',
		cell: (parcel) => (
			<Link to={`/app/parcels/${parcel.id}`}>
				{parcel.tracking} · {parcel.recipient}
			</Link>
		),
	},
	{ key: 'merchant', header: 'Merchant', sortable: true, cell: (parcel) => parcel.merchant },
	{
		key: 'zone',
		header: 'Zone / driver',
		cell: (parcel) => `${parcel.zone} · ${findDriver(parcel.driverId)?.name ?? 'Unassigned'}`,
	},
	{
		key: 'status',
		header: 'Delivery status',
		cell: (parcel) => parcelStatusLabels[parcel.status],
	},
	{ key: 'action', header: 'Action', cell: (parcel) => <ParcelAction parcel={parcel} /> },
];

export function DispatchPage() {
	const [search, setSearch] = useState('');
	const [queue, setQueue] = useState('all');
	const [sort, setSort] = useState<TableSort | null>(null);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);

	return (
		<div className="flex flex-col gap-4">
			<ModulePage
				title="Dispatch & parcels"
				description="Assign ready parcels and resolve delivery exceptions."
				actions={
					<Link
						to="/app/parcels/assign"
						className="btn btn-primary w-full md:w-auto md:px-12"
					>
						Assign driver
					</Link>
				}
			/>
			<AnalyticsCard items={dispatchStats} />
			<section aria-labelledby="parcel-queue-title" className="mt-4 flex flex-col gap-4">
				<div>
					<h2 id="parcel-queue-title" className="font-medium">
						Parcel queue
					</h2>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						24 parcels are ready for driver assignment
					</p>
				</div>
				<Table
					caption="Parcel queue"
					columns={columns}
					rows={parcels}
					getRowKey={(parcel) => parcel.id}
					sort={sort}
					onSortChange={(next) => {
						setSort(next);
						setPage(1);
					}}
					search={{
						value: search,
						placeholder: 'Search tracking or recipient',
						onChange: (value) => {
							setSearch(value);
							setPage(1);
						},
					}}
					filter={{
						label: 'Queue',
						options: queueFilters,
						value: queue,
						onChange: (value) => {
							setQueue(value);
							setPage(1);
						},
					}}
					pagination={{
						page,
						pageSize,
						total: parcels.length,
						onPageChange: setPage,
						onPageSizeChange: (size) => {
							setPageSize(size);
							setPage(1);
						},
					}}
					emptyMessage="No parcels match this search."
				/>
			</section>

			<div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<section
					aria-labelledby="available-drivers-title"
					className="rounded-box bg-base-200 p-6 md:p-8"
				>
					<h2 id="available-drivers-title" className="font-semibold">
						Available drivers
					</h2>
					<ul className="mt-6 flex flex-col gap-5">
						{drivers.map((driver) => (
							<li
								key={driver.id}
								className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2"
							>
								<span
									aria-hidden="true"
									className="text-xs text-[var(--color-slate)]"
								>
									{driver.initials}
								</span>
								<div>
									<p className="font-medium">
										{driver.name} · {driver.vehicle}
									</p>
									<p className="mt-1 text-xs text-[var(--color-slate)]">
										{driverStatusLabels[driver.status]} · {driver.zone} zone
									</p>
								</div>
							</li>
						))}
					</ul>
				</section>
				<TipCard
					title="Every parcel has an owner."
					description="Assigned drivers see only their work. Reassignment keeps the delivery history intact."
					footer="Pickup → Hub → Delivery → POD"
				/>
			</div>
		</div>
	);
}
