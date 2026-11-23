import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Input } from '@global-components';
import { errorCode } from '@services/api-client';
import { formatDate } from '@utils/format';
import type { ParcelStatus, ParcelTracking } from '../api';
import { parcelStatusLabels } from '../constants';
import { useParcelTracking } from '../hooks/useParcels';

const publicStatusLabels: Record<ParcelStatus, string> = {
	...parcelStatusLabels,
	delivered: 'Delivered',
};

// The usual way to the door, drawn as the progress bar. A parcel off this path (a failed attempt, a return) shows
// only its timeline.
const JOURNEY: ParcelStatus[] = [
	'pickup_scheduled',
	'picked_up',
	'in_hub_sorted',
	'out_for_delivery',
	'delivered',
];

// /track and /track/:trackingNumber, open to anyone. Shows only the status and its times: never the recipient, the
// address, COD or who handled the parcel (GET /api/tracking/:trackingNumber answers nothing more).
export function TrackParcelPage() {
	const { trackingNumber } = useParams();
	const navigate = useNavigate();
	useEffect(() => {
		document.title = 'Track a parcel — Transcend';
	}, []);
	const { tracked, trackingError, isTrackingPending } = useParcelTracking(trackingNumber);

	return (
		<section className="mx-auto flex max-w-3xl flex-col items-center px-6 py-16 md:px-10 md:py-24">
			<p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em]">Parcel tracking</p>
			<h1 className="marketing-title text-center text-5xl md:text-7xl">Track a parcel</h1>
			<p className="mt-6 max-w-md text-center text-lg leading-relaxed opacity-70">
				Enter the tracking number from your waybill to see where your parcel is.
			</p>

			<div className="mt-12 w-full">
				<form
					key={trackingNumber}
					className="flex flex-col gap-3 sm:flex-row sm:items-end"
					onSubmit={(event) => {
						event.preventDefault();
						const value = new FormData(event.currentTarget).get('tracking');
						navigate(`/track/${encodeURIComponent(String(value).trim())}`);
					}}
				>
					<Input
						label="Tracking number"
						name="tracking"
						required
						dir="ltr"
						autoComplete="off"
						placeholder="TRC-7KQ2M9XH4P"
						defaultValue={trackingNumber}
						containerClassName="grow"
						className="font-mono"
					/>
					<Button type="submit">
						Track <span aria-hidden="true">→</span>
					</Button>
				</form>

				<p className="mt-3 text-xs opacity-60">
					Tracking shows the parcel's status and times only — never the recipient, the
					address or the payment.
				</p>

				{isTrackingPending && (
					<p role="status" className="mt-6 flex items-center gap-3 text-sm opacity-70">
						<span aria-hidden="true" className="loading loading-spinner loading-sm" />
						Looking up <span className="font-mono">{trackingNumber}</span>…
					</p>
				)}

				{trackingError && (
					<p
						role="alert"
						className="mt-6 rounded-2xl border border-base-300 p-4 text-sm sm:p-6"
					>
						<TrackingErrorMessage
							error={trackingError}
							trackingNumber={trackingNumber}
						/>
					</p>
				)}

				{tracked && <TrackingResult parcel={tracked} />}
			</div>
		</section>
	);
}

function TrackingErrorMessage({
	error,
	trackingNumber,
}: {
	error: Error;
	trackingNumber?: string;
}) {
	const code = errorCode(error);
	if (code === 'TRACKING_NOT_FOUND')
		return (
			<>
				No parcel matches <span className="font-mono">{trackingNumber}</span>. Check the
				number on your waybill and try again.
			</>
		);
	if (code === 'TRACKING_TOO_MANY_LOOKUPS') return <>{error.message}</>;
	return <>Tracking isn't available right now. Try again in a moment.</>;
}

function TrackingResult({ parcel }: { parcel: ParcelTracking }) {
	const { i18n } = useTranslation();
	const time = (value: string) =>
		formatDate(value, i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
	const reached = JOURNEY.indexOf(parcel.status);
	const events = [...parcel.events].reverse();

	return (
		<div className="mt-6 rounded-2xl border border-base-300 p-5 sm:p-8">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<p dir="ltr" className="font-mono text-sm opacity-60">
						{parcel.trackingNumber}
					</p>
					<h2 className="marketing-title mt-2 text-3xl md:text-4xl">
						{publicStatusLabels[parcel.status]}
					</h2>
					<p className="mt-2 text-sm opacity-70">Carried by {parcel.company}</p>
				</div>
				{/* Every parcel has a history: creating it records the scheduled pickup. */}
				<p className="flex items-center gap-2 rounded-full bg-base-200 px-3 py-1.5 text-xs font-medium">
					<span
						aria-hidden="true"
						className="size-2 rounded-full bg-primary ring-2 ring-primary/40"
					/>
					Updated {time(events[0].at)}
				</p>
			</div>

			{reached >= 0 && (
				<ol aria-label="Delivery progress" className="mt-8 grid grid-cols-5 gap-2">
					{JOURNEY.map((status, index) => (
						<li key={status} aria-current={index === reached ? 'step' : undefined}>
							<span
								aria-hidden="true"
								className={`block h-1.5 rounded-full ${index <= reached ? 'bg-primary' : 'bg-base-300'}`}
							/>
							<span
								className={`mt-2 hidden text-xs sm:block ${index <= reached ? 'font-medium' : 'opacity-50'}`}
							>
								{publicStatusLabels[status]}
							</span>
						</li>
					))}
				</ol>
			)}

			<ol aria-label="Tracking history" className="mt-8">
				{events.map((event, index) => (
					<li key={`${event.status}-${event.at}`} className="flex gap-4">
						<div aria-hidden="true" className="flex flex-col items-center">
							<span
								className={`mt-1.5 size-2.5 shrink-0 rounded-full ${index === 0 ? 'bg-primary ring-4 ring-primary/30' : 'bg-base-300'}`}
							/>
							{index < events.length - 1 && (
								<span className="mt-1 w-px grow bg-base-300" />
							)}
						</div>
						<div
							className={`flex grow flex-col gap-1 sm:flex-row sm:justify-between ${index < events.length - 1 ? 'pb-6' : ''}`}
						>
							<p className={index === 0 ? 'font-semibold' : 'font-medium opacity-80'}>
								{publicStatusLabels[event.status]}
							</p>
							<p dir="ltr" className="font-mono text-sm opacity-60">
								{time(event.at)}
							</p>
						</div>
					</li>
				))}
			</ol>
		</div>
	);
}
