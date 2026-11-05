import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Input } from '@global-components';
import type { ParcelStatus } from '../api';
import { parcelStatusLabels } from '../constants';
import { parcels } from '../data/sampleParcels';

const publicStatusLabels: Record<ParcelStatus, string> = {
	...parcelStatusLabels,
	delivered: 'Delivered',
};

// /track and /track/:trackingNumber, open to anyone. Shows only the status and its times: never the recipient, the
// address, COD or who handled the parcel. Sample data until the tracking endpoint exists.
export function TrackParcelPage() {
	const { trackingNumber } = useParams();
	const navigate = useNavigate();
	useEffect(() => {
		document.title = 'Track a parcel — Transcend';
	}, []);
	const parcel = parcels.find(
		(item) => item.tracking.toLowerCase() === trackingNumber?.toLowerCase(),
	);

	return (
		<section className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16 md:px-10 md:py-24">
			<div>
				<h1 className="text-3xl font-semibold">Track a parcel</h1>
				<p className="mt-2 opacity-70">Enter the tracking number from your waybill.</p>
			</div>
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
					placeholder="TRC-10474"
					defaultValue={trackingNumber}
					containerClassName="grow"
				/>
				<Button type="submit">Track</Button>
			</form>

			{trackingNumber && !parcel && (
				<p role="alert" className="rounded-box border border-base-300 p-4 text-sm">
					No parcel matches this tracking number. Check it and try again.
				</p>
			)}

			{parcel && (
				<div className="rounded-box border border-base-300 p-4 md:p-8">
					<p dir="ltr" className="text-sm opacity-70">
						{parcel.tracking}
					</p>
					<h2 className="mt-1 text-xl font-semibold">
						{publicStatusLabels[parcel.status]}
					</h2>
					<ol className="mt-6 flex flex-col gap-3">
						{[...parcel.events].reverse().map((event) => (
							<li
								key={`${event.status}-${event.time}`}
								className="flex flex-col gap-1 rounded-box bg-base-200 p-4 sm:flex-row sm:justify-between"
							>
								<p className="font-medium">{publicStatusLabels[event.status]}</p>
								<p className="text-sm opacity-70">{event.time}</p>
							</li>
						))}
					</ol>
				</div>
			)}
		</section>
	);
}
