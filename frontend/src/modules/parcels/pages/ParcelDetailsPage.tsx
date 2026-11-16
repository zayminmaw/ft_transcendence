import { lazy, Suspense, useState } from 'react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { DetailItem, ModulePage, TipCard } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { useCan } from '@modules/auth';
import { formatDate } from '@utils/format';
import type { ParcelEvent, ParcelStatus } from '../api';
import {
	MarkInHubDialog,
	MarkPickedUpDialog,
	RecordFailureDialog,
	ReturnToSenderDialog,
} from '../components/ParcelDialogs';
import type { ParcelDialogProps } from '../components/ParcelDialogs';
import {
	ASSIGNABLE_STATUSES,
	failureReasonLabels,
	parcelStatusLabels,
	vehicleLabel,
} from '../constants';
import { useParcelDetails } from '../hooks/useParcels';

// Only this page needs the barcode libraries; imported directly, every page would download them, public ones included.
const WaybillCodes = lazy(() =>
	import('../components/WaybillCodes').then((module) => ({ default: module.WaybillCodes })),
);

const primaryAction = 'btn btn-primary md:px-8';
const secondaryAction = 'btn border-0 bg-base-200';

// The status move each status offers through a dialog (parcels.update_status). Links to other pages sit next to it
// in the header.
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

// What a step records besides its status: where in the hub, who it went out with, why it failed, and the notes.
function eventDetails(event: ParcelEvent) {
	const parts: string[] = [];
	if (event.hubLocation) parts.push(event.hubLocation);
	if (event.status === 'out_for_delivery' && event.driver) {
		parts.push(`Assigned to ${event.driver.name}`, vehicleLabel(event.vehicle));
		if (event.run) parts.push(event.run.code);
	} else if (event.driver) parts.push(event.driver.name);
	if (event.reasonCode) parts.push(failureReasonLabels[event.reasonCode]);
	if (event.notes) parts.push(event.notes);
	return parts.join(' · ');
}

export function ParcelDetailsPage() {
	const { parcelId = '' } = useParams();
	const { i18n } = useTranslation();
	const companyPath = useCompanyPath();
	const can = useCan();
	const [actionOpen, setActionOpen] = useState(false);
	const { parcel, isParcelPending } = useParcelDetails(parcelId);

	if (isParcelPending) return <span className="loading loading-spinner" aria-label="Loading" />;
	if (!parcel) {
		return (
			<ModulePage
				title="Parcel not found"
				description="Choose a parcel from the dispatch queue to continue."
			/>
		);
	}

	const time = (value: string) =>
		formatDate(value, i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
	const failed = parcel.status === 'failed_attempt';
	const returned = parcel.status === 'returned_to_sender';
	const assignable = can('parcels.dispatch') && ASSIGNABLE_STATUSES.includes(parcel.status);
	const action = can('parcels.update_status') ? dialogActions[parcel.status] : undefined;
	const deliverable = can('parcels.mark_delivered') && parcel.status === 'out_for_delivery';
	const reason = parcel.failedReasonCode && failureReasonLabels[parcel.failedReasonCode];

	const details = [
		{ label: 'Recipient', value: parcel.recipientName },
		{
			label: 'Recipient phone',
			value: [parcel.recipientPhone, parcel.recipientSecondaryPhone]
				.filter(Boolean)
				.join(' · '),
			ltr: true,
		},
		{ label: 'Delivery address', value: parcel.deliveryAddress },
		{
			label: 'Delivery zone',
			value: [`${parcel.deliveryCityZone} zone`, parcel.deliveryLandmark]
				.filter(Boolean)
				.join(' · '),
		},
		{ label: 'Merchant', value: `${parcel.client.name} · ${parcel.client.code}` },
		{ label: 'Package', value: `${parcel.weightKg} kg${parcel.isFragile ? ' · Fragile' : ''}` },
		{ label: 'COD amount', value: `${parcel.codAmount} CUR` },
		{ label: 'Delivery fee', value: `${parcel.deliveryFee} CUR` },
	];

	const ownership = [
		{ label: 'Status', value: parcelStatusLabels[parcel.status] },
		{ label: 'Driver', value: parcel.driver?.name ?? 'Unassigned' },
		{ label: 'Vehicle', value: parcel.driver ? vehicleLabel(parcel.vehicle) : '—' },
		{ label: 'Run', value: parcel.run?.code ?? '—' },
		{ label: 'Failed attempts', value: parcel.deliveryAttemptCount },
	];

	return (
		<div className="flex flex-col gap-6">
			<Link to={companyPath('parcels')} className="link link-hover w-fit text-sm">
				Back to dispatch
			</Link>
			<ModulePage
				title={parcel.trackingNumber}
				description={`${parcel.recipientName} · ${parcel.client.name} · ${parcelStatusLabels[parcel.status]}`}
				actions={
					(action || assignable || deliverable) && (
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
							{assignable && (
								<Link
									to={companyPath(`parcels/assign?parcel=${parcel.id}`)}
									className={primaryAction}
								>
									{failed ? 'Reassign for reattempt' : 'Assign driver'}
								</Link>
							)}
							{deliverable && (
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

			{(failed || returned) && reason && (
				<div role="status" className="rounded-box border border-base-300 p-4 text-sm">
					<p className="font-medium">
						{failed ? 'Delivery attempt failed' : 'Returned to sender'} · {reason}
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
								<DetailItem key={item.label} label={item.label} ltr={item.ltr}>
									{item.value}
								</DetailItem>
							))}
						</dl>
					</section>

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
							{[...parcel.events].reverse().map((event) => {
								const more = eventDetails(event);
								return (
									<li
										key={event.id}
										className="flex flex-col gap-1 rounded-box bg-base-200 p-4 sm:flex-row sm:justify-between"
									>
										<div className="min-w-0">
											<p className="font-medium">
												{parcelStatusLabels[event.status]}
											</p>
											{more && (
												<p className="text-sm break-words text-[var(--color-slate)]">
													{more}
												</p>
											)}
										</div>
										<p className="shrink-0 text-sm text-[var(--color-slate)] sm:text-end">
											{time(event.at)}
											<br />
											{event.actor?.name ?? 'Removed account'}
										</p>
									</li>
								);
							})}
						</ol>
					</section>
				</div>

				<aside className="flex flex-col gap-6">
					<Suspense fallback={null}>
						<WaybillCodes tracking={parcel.trackingNumber} />
					</Suspense>
					<section className="rounded-box bg-base-200 p-6 md:p-8">
						<h2 className="text-lg font-semibold">Ownership</h2>
						<dl className="mt-6 flex flex-col gap-5">
							{ownership.map((item) => (
								<DetailItem
									key={item.label}
									label={item.label}
									valueClassName="text-lg font-semibold"
								>
									{item.value}
								</DetailItem>
							))}
						</dl>
					</section>
					<TipCard
						title="Exceptions keep their outcome."
						description="Failed attempts and returns stay in the delivery history with their reason. Reassigning starts a new attempt; it does not erase the last one."
					/>
				</aside>
			</div>

			{actionOpen && action && (
				<action.Dialog parcel={parcel} onClose={() => setActionOpen(false)} />
			)}
		</div>
	);
}
