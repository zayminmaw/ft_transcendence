import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Dialog, ModulePage, TipCard, useToast } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { findDriver, parcelStatusLabels, parcels } from '../data/sampleParcels';

export function ParcelDetailsPage() {
	const { parcelId } = useParams();
	const companyPath = useCompanyPath();
	const { toast } = useToast();
	const [returnOpen, setReturnOpen] = useState(false);
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
					(failed || assignable) && (
						<div className="flex flex-col gap-2 sm:flex-row">
							{failed && (
								<button
									type="button"
									className="btn border-0 bg-base-200"
									onClick={() => setReturnOpen(true)}
								>
									Return to sender
								</button>
							)}
							<Link
								to={companyPath(`parcels/assign?parcel=${parcel.id}`)}
								className="btn btn-primary md:px-8"
							>
								{failed ? 'Reassign for reattempt' : 'Assign driver'}
							</Link>
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

			<Dialog
				open={returnOpen}
				onClose={() => setReturnOpen(false)}
				title={`Return ${parcel.tracking} to sender?`}
				description={`The parcel goes back to ${parcel.merchant}. COD is not collected and the return is recorded in the delivery history.`}
				onSubmit={(e) => {
					e.preventDefault();
					setReturnOpen(false);
					toast({ variant: 'success', title: 'Parcel marked for return' });
				}}
				actions={
					<>
						<button
							type="button"
							className="btn border-0 bg-base-200"
							onClick={() => setReturnOpen(false)}
						>
							Cancel
						</button>
						<button type="submit" className="btn btn-neutral">
							Return to sender
						</button>
					</>
				}
			>
				<div>
					<label htmlFor="return-reason" className="mb-2 block text-sm font-medium">
						Reason *
					</label>
					<textarea
						id="return-reason"
						className="textarea w-full"
						rows={3}
						required
						defaultValue={parcel.failedReason}
					/>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						Recorded on the parcel with your account.
					</p>
				</div>
			</Dialog>
		</div>
	);
}
