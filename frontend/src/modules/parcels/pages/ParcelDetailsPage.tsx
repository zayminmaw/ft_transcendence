import { lazy, Suspense, useState } from 'react';
import type { ComponentType } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DetailItem, ModulePage, TipCard } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import {
	MarkInHubDialog,
	MarkPickedUpDialog,
	RecordFailureDialog,
	ReturnToSenderDialog,
} from '../components/ParcelDialogs';
import type { ParcelDialogProps } from '../components/ParcelDialogs';
import { findDriver, parcelStatusLabels, parcels } from '../data/sampleParcels';
import type { ParcelStatus } from '../data/sampleParcels';

// Only this page needs the barcode libraries; imported directly, every page would download them, public ones included.
const WaybillCodes = lazy(() =>
	import('../components/WaybillCodes').then((module) => ({ default: module.WaybillCodes })),
);

const primaryAction = 'btn btn-primary md:px-8';
const secondaryAction = 'btn border-0 bg-base-200';

// The action each status offers through a dialog. Links to other pages sit next to it in the header.
const dialogActions: Partial<
	Record<
		ParcelStatus,
		{ label: string; className: string; Dialog: ComponentType<ParcelDialogProps> }
	>
> = {
	pickup_scheduled: {
		label: 'Mark picked up',
		className: primaryAction,
		Dialog: MarkPickedUpDialog,
	},
	picked_up: { label: 'Mark in hub', className: primaryAction, Dialog: MarkInHubDialog },
	out_for_delivery: {
		label: 'Record failure',
		className: secondaryAction,
		Dialog: RecordFailureDialog,
	},
	failed_attempt: {
		label: 'Return to sender',
		className: secondaryAction,
		Dialog: ReturnToSenderDialog,
	},
};

export function ParcelDetailsPage() {
	const { parcelId } = useParams();
	const companyPath = useCompanyPath();
	const [actionOpen, setActionOpen] = useState(false);
	const parcel = parcels.find((item) => item.id === parcelId);

	if (!parcel) {
		return (
			<ModulePage
				title="Parcel not found"
				description="Choose a parcel from the dispatch queue to continue."
			/>
		);
	}

	const driver = findDriver(parcel.driverId);
	const failed = parcel.status === 'failed_attempt';
	const assignable = parcel.status === 'in_hub_sorted' && !driver;
	const action = dialogActions[parcel.status];

	const details = [
		{ label: 'Recipient', value: parcel.recipient },
		{ label: 'Recipient phone', value: parcel.recipientPhone },
		{ label: 'Delivery address', value: parcel.address },
		{ label: 'Delivery zone', value: `${parcel.zone} zone` },
		{ label: 'Merchant', value: parcel.merchant },
		{ label: 'Package', value: `${parcel.weightKg} kg${parcel.fragile ? ' · Fragile' : ''}` },
		{ label: 'COD amount', value: `${parcel.codAmount} CUR` },
		{ label: 'Delivery fee', value: `${parcel.deliveryFee} CUR` },
	];

	const ownership = [
		{ label: 'Status', value: parcelStatusLabels[parcel.status] },
		{ label: 'Driver', value: driver?.name ?? 'Unassigned' },
		{ label: 'Asset', value: driver?.vehicle ?? '—' },
		{ label: 'Failed attempts', value: parcel.attempts },
	];

	return (
		<div className="flex flex-col gap-6">
			<ModulePage
				title={parcel.tracking}
				description={`${parcel.recipient} · ${parcel.merchant} · ${parcelStatusLabels[parcel.status]}`}
				actions={
					(action || assignable) && (
						<div className="flex flex-col gap-2 sm:flex-row">
							{action && (
								<button
									type="button"
									className={action.className}
									onClick={() => setActionOpen(true)}
								>
									{action.label}
								</button>
							)}
							{(failed || assignable) && (
								<Link
									to={companyPath(`parcels/assign?parcel=${parcel.id}`)}
									className={primaryAction}
								>
									{failed ? 'Reassign for reattempt' : 'Assign driver'}
								</Link>
							)}
							{parcel.status === 'out_for_delivery' && (
								<Link
									to={companyPath(`parcels/${parcel.id}/deliver`)}
									className={primaryAction}
								>
									Record delivery
								</Link>
							)}
						</div>
					)
				}
			/>

			{parcel.failedReason && (
				<div role="status" className="rounded-box border border-base-300 p-4 text-sm">
					<p className="font-medium">
						{failed ? 'Delivery attempt failed' : 'Returned to sender'} ·{' '}
						{parcel.failedReason}
					</p>
					<p className="mt-1 text-[var(--color-slate)]">
						{failed
							? 'Reassign the parcel for another attempt or return it to the merchant.'
							: 'COD was not collected. The return is recorded in the delivery history.'}
					</p>
				</div>
			)}

			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<div className="flex flex-col gap-6">
					<section
						aria-labelledby="parcel-details-title"
						className="rounded-box border border-base-300 p-4 md:p-8"
					>
						<h2 id="parcel-details-title" className="text-lg font-semibold">
							Parcel
						</h2>
						<dl className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
							{details.map((item) => (
								<div key={item.label} className="min-w-0">
									<dt className="text-sm text-[var(--color-slate)]">
										{item.label}
									</dt>
									<dd className="mt-1 font-medium break-words">{item.value}</dd>
								</div>
							))}
						</dl>
					</section>

					{parcel.pod && (
						<section
							aria-labelledby="parcel-pod-title"
							className="rounded-box border border-base-300 p-4 md:p-8"
						>
							<h2 id="parcel-pod-title" className="text-lg font-semibold">
								Proof of delivery
							</h2>
							<dl className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
								<DetailItem label="Delivered at">
									{parcel.pod.deliveredAt}
								</DetailItem>
								<DetailItem label="Location" ltr>
									{parcel.pod.latitude}, {parcel.pod.longitude}
								</DetailItem>
							</dl>
							<div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
								{['Signature', 'Doorstep photo'].map((label) => (
									<div
										key={label}
										className="grid h-32 place-items-center rounded-box bg-base-200 text-sm text-[var(--color-slate)]"
									>
										{label}
									</div>
								))}
							</div>
						</section>
					)}

					<section
						aria-labelledby="parcel-history-title"
						className="rounded-box border border-base-300 p-4 md:p-8"
					>
						<h2 id="parcel-history-title" className="text-lg font-semibold">
							Delivery history
						</h2>
						<p className="mt-1 text-sm text-[var(--color-slate)]">
							Every scan and handoff, newest first.
						</p>
						<ol className="mt-6 flex flex-col gap-3">
							{[...parcel.events].reverse().map((event) => (
								<li
									key={`${event.status}-${event.time}`}
									className="flex flex-col gap-1 rounded-box bg-base-200 p-4 sm:flex-row sm:justify-between"
								>
									<div>
										<p className="font-medium">
											{parcelStatusLabels[event.status]}
										</p>
										{event.notes && (
											<p className="text-sm text-[var(--color-slate)]">
												{event.notes}
											</p>
										)}
									</div>
									<p className="text-sm text-[var(--color-slate)] sm:text-end">
										{event.time}
										<br />
										{event.actor}
									</p>
								</li>
							))}
						</ol>
					</section>
				</div>

				<aside className="flex flex-col gap-6">
					<Suspense fallback={null}>
						<WaybillCodes tracking={parcel.tracking} />
					</Suspense>
					<section className="rounded-box bg-base-200 p-6 md:p-8">
						<h2 className="text-lg font-semibold">Ownership</h2>
						<dl className="mt-6 flex flex-col gap-5">
							{ownership.map((item) => (
								<div key={item.label}>
									<dt className="text-sm text-[var(--color-slate)]">
										{item.label}
									</dt>
									<dd className="mt-1 text-lg font-semibold">{item.value}</dd>
								</div>
							))}
						</dl>
					</section>
					{parcel.status === 'delivered' ? (
						<TipCard
							title="Delivered with proof."
							description="Signature, doorstep photo and delivery location are attached. The COD amount moves to the driver's cash sheet for finance review."
						/>
					) : (
						<TipCard
							title="Exceptions keep their outcome."
							description="Failed attempts and returns stay in the delivery history with their reason. Reassigning starts a new attempt; it does not erase the last one."
						/>
					)}
				</aside>
			</div>

			{action && (
				<action.Dialog
					parcel={parcel}
					open={actionOpen}
					onClose={() => setActionOpen(false)}
				/>
			)}
		</div>
	);
}
