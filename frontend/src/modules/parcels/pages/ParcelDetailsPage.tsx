import { lazy, Suspense, useState } from 'react';
import type { ComponentType } from 'react';
import type { TFunction } from 'i18next';
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
import { ASSIGNABLE_STATUSES, vehicleLabel } from '../constants';
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
		{
			label: 'pickedUp' | 'inHub' | 'failure' | 'return';
			className: string;
			Dialog: ComponentType<ParcelDialogProps>;
		}
	>
> = {
	pickup_scheduled: {
		label: 'pickedUp',
		className: primaryAction,
		Dialog: MarkPickedUpDialog,
	},
	picked_up: { label: 'inHub', className: primaryAction, Dialog: MarkInHubDialog },
	out_for_delivery: {
		label: 'failure',
		className: secondaryAction,
		Dialog: RecordFailureDialog,
	},
	failed_attempt: {
		label: 'return',
		className: secondaryAction,
		Dialog: ReturnToSenderDialog,
	},
};

// What a step records besides its status: where in the hub, who it went out with, why it failed, and the notes.
function eventDetails(t: TFunction<'parcels'>, event: ParcelEvent) {
	const parts: string[] = [];
	if (event.hubLocation) parts.push(event.hubLocation);
	if (event.status === 'out_for_delivery' && event.driver) {
		parts.push(
			t('details.assignedTo', { driver: event.driver.name }),
			vehicleLabel(t, event.vehicle),
		);
		if (event.run) parts.push(event.run.code);
	} else if (event.driver) parts.push(event.driver.name);
	if (event.reasonCode) parts.push(t(`failureReasons.${event.reasonCode}`));
	if (event.notes) parts.push(event.notes);
	return parts.join(' · ');
}

export function ParcelDetailsPage() {
	const { parcelId = '' } = useParams();
	const { t, i18n } = useTranslation('parcels');
	const companyPath = useCompanyPath();
	const can = useCan();
	const [actionOpen, setActionOpen] = useState(false);
	const { parcel, isParcelPending } = useParcelDetails(parcelId);

	if (isParcelPending)
		return <span className="loading loading-spinner" aria-label={t('common.loading')} />;
	if (!parcel) {
		return (
			<ModulePage title={t('details.notFoundTitle')} description={t('details.notFound')} />
		);
	}

	const time = (value: string) =>
		formatDate(value, i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
	const failed = parcel.status === 'failed_attempt';
	const returned = parcel.status === 'returned_to_sender';
	const assignable = can('parcels.dispatch') && ASSIGNABLE_STATUSES.includes(parcel.status);
	const action = can('parcels.update_status') ? dialogActions[parcel.status] : undefined;
	const deliverable = can('parcels.mark_delivered') && parcel.status === 'out_for_delivery';
	const reason = parcel.failedReasonCode && t(`failureReasons.${parcel.failedReasonCode}`);

	const details = [
		{ label: t('details.recipient'), value: parcel.recipientName },
		{
			label: t('details.recipientPhone'),
			value: [parcel.recipientPhone, parcel.recipientSecondaryPhone]
				.filter(Boolean)
				.join(' · '),
			ltr: true,
		},
		{ label: t('details.deliveryAddress'), value: parcel.deliveryAddress },
		{
			label: t('common.deliveryZone'),
			value: [t('common.zone', { zone: parcel.deliveryCityZone }), parcel.deliveryLandmark]
				.filter(Boolean)
				.join(' · '),
		},
		{ label: t('common.merchant'), value: `${parcel.client.name} · ${parcel.client.code}` },
		{
			label: t('details.package'),
			value: [
				t('details.weight', { value: parcel.weightKg }),
				parcel.isFragile && t('details.fragile'),
			]
				.filter(Boolean)
				.join(' · '),
		},
		{ label: t('common.codAmount'), value: t('common.money', { amount: parcel.codAmount }) },
		{
			label: t('common.deliveryFee'),
			value: t('common.money', { amount: parcel.deliveryFee }),
		},
	];

	const ownership = [
		{ label: t('details.status'), value: t(`status.${parcel.status}`) },
		{ label: t('details.driver'), value: parcel.driver?.name ?? t('common.unassigned') },
		{
			label: t('common.vehicle'),
			value: parcel.driver ? vehicleLabel(t, parcel.vehicle) : '—',
		},
		{ label: t('common.run'), value: parcel.run?.code ?? '—' },
		{ label: t('details.failedAttempts'), value: parcel.deliveryAttemptCount },
	];

	return (
		<div className="flex flex-col gap-6">
			<Link to={companyPath('parcels')} className="link link-hover w-fit text-sm">
				{t('common.backToDispatch')}
			</Link>
			<ModulePage
				title={parcel.trackingNumber}
				description={`${parcel.recipientName} · ${parcel.client.name} · ${t(`status.${parcel.status}`)}`}
				actions={
					(action || assignable || deliverable) && (
						<div className="flex flex-col gap-2 sm:flex-row">
							{action && (
								<button
									type="button"
									className={action.className}
									onClick={() => setActionOpen(true)}
								>
									{t(`dialogs.${action.label}.action`)}
								</button>
							)}
							{assignable && (
								<Link
									to={companyPath(`parcels/assign?parcel=${parcel.id}`)}
									className={primaryAction}
								>
									{failed ? t('details.reassign') : t('dispatch.assignDriver')}
								</Link>
							)}
							{deliverable && (
								<Link
									to={companyPath(`parcels/${parcel.id}/deliver`)}
									className={primaryAction}
								>
									{t('details.recordDelivery')}
								</Link>
							)}
						</div>
					)
				}
			/>

			{(failed || returned) && reason && (
				<div role="status" className="rounded-box border border-base-300 p-4 text-sm">
					<p className="font-medium">
						{failed ? t('details.failedTitle') : t('status.returned_to_sender')} ·{' '}
						{reason}
					</p>
					<p className="mt-1 text-[var(--color-slate)]">
						{failed ? t('details.failedText') : t('details.returnedText')}
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
							{t('details.parcel')}
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
							{t('details.history')}
						</h2>
						<p className="mt-1 text-sm text-[var(--color-slate)]">
							{t('details.historyNote')}
						</p>
						<ol className="mt-6 flex flex-col gap-3">
							{[...parcel.events].reverse().map((event) => {
								const more = eventDetails(t, event);
								return (
									<li
										key={event.id}
										className="flex flex-col gap-1 rounded-box bg-base-200 p-4 sm:flex-row sm:justify-between"
									>
										<div className="min-w-0">
											<p className="font-medium">
												{t(`status.${event.status}`)}
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
											{event.actor?.name ?? t('common.removedAccount')}
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
						<h2 className="text-lg font-semibold">{t('details.ownership')}</h2>
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
					<TipCard title={t('details.tipTitle')} description={t('details.tipText')} />
				</aside>
			</div>

			{actionOpen && action && (
				<action.Dialog parcel={parcel} onClose={() => setActionOpen(false)} />
			)}
		</div>
	);
}
