import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Input, ModulePage, Textarea, TipCard, useToast } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { SignaturePad } from '../components/SignaturePad';
import { useParcelMutations } from '../hooks/useParcelMutations';
import { useParcelDetails } from '../hooks/useParcels';

// The same pattern as the API: an amount with at most two decimals.
const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

// /parcels/:parcelId/deliver. Confirming records the delivery and the cash the driver collected, which must be the
// amount due. The signature, photo and location are not saved yet: the API has nowhere to keep them.
export function RecordDeliveryPage() {
	const { parcelId = '' } = useParams();
	const navigate = useNavigate();
	const companyPath = useCompanyPath();
	const { toast } = useToast();
	const [location, setLocation] = useState('Not captured');
	const [error, setError] = useState<string | null>(null);
	const { deliverParcel, isDelivering } = useParcelMutations();
	const { parcel, isParcelPending } = useParcelDetails(parcelId);

	if (isParcelPending) return <span className="loading loading-spinner" aria-label="Loading" />;
	if (parcel?.status !== 'out_for_delivery') {
		return (
			<ModulePage
				title="This parcel can't be delivered"
				description="Only a parcel that is out for delivery can have its delivery recorded."
			/>
		);
	}

	const detailsPath = companyPath(`parcels/${parcel.id}`);

	const captureLocation = () => {
		setLocation('Locating…');
		navigator.geolocation.getCurrentPosition(
			({ coords }) =>
				setLocation(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`),
			() => setLocation('Not available. You can still record the delivery.'),
		);
	};

	return (
		<div className="flex flex-col gap-6">
			<Link to={detailsPath} className="link link-hover w-fit text-sm">
				Back to {parcel.trackingNumber}
			</Link>
			<ModulePage
				title={`Record delivery of ${parcel.trackingNumber}`}
				description={`${parcel.recipientName} · ${parcel.deliveryAddress} · Collect COD ${parcel.codAmount} CUR`}
			/>
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<form
					onSubmit={(event) => {
						event.preventDefault();
						setError(null);
						const form = new FormData(event.currentTarget);
						const collectedAmount = String(form.get('collectedAmount') ?? '').trim();
						if (!AMOUNT_PATTERN.test(collectedAmount)) {
							setError(
								'Enter the cash collected as an amount with up to 2 decimals.',
							);
							return;
						}
						// As typed: the API trims the notes and drops empty ones.
						const notes = String(form.get('notes') ?? '');
						deliverParcel(
							{ parcelId: parcel.id, values: { collectedAmount, notes } },
							{
								onSuccess: (saved) => {
									toast({
										variant: 'success',
										title: 'Delivery recorded',
										description: `${saved.trackingNumber} is delivered and ${saved.codAmount} CUR was collected.`,
									});
									navigate(detailsPath);
								},
								onError: (failure) => setError(failure.message),
							},
						);
					}}
					className="flex flex-col gap-6 rounded-box border border-base-300 p-4 md:p-8"
				>
					{error && (
						<p role="alert" className="rounded-box bg-error/10 p-4 text-sm text-error">
							{error}
						</p>
					)}
					<div>
						<Input
							label="Cash collected"
							name="collectedAmount"
							required
							dir="ltr"
							inputMode="decimal"
							autoComplete="off"
							defaultValue={parcel.codAmount}
						/>
						<p className="mt-1 text-sm text-[var(--color-slate)]">
							Amount due {parcel.codAmount} CUR. It must match what you took at the
							door.
						</p>
					</div>
					<SignaturePad />
					<div>
						<label htmlFor="doorstep-photo" className="mb-2 block text-sm font-medium">
							Doorstep photo (not saved yet)
						</label>
						<input
							id="doorstep-photo"
							type="file"
							accept="image/jpeg,image/png,image/webp"
							capture="environment"
							className="file-input w-full"
						/>
					</div>
					<div>
						<p className="mb-2 text-sm font-medium">Delivery location</p>
						<div className="flex flex-wrap items-center gap-3">
							<button
								type="button"
								className="btn border-0 bg-base-200"
								onClick={captureLocation}
							>
								Capture location
							</button>
							<p role="status" className="text-sm text-[var(--color-slate)]">
								{location}
							</p>
						</div>
					</div>
					<Textarea label="Notes" name="notes" />
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className="btn border-0 bg-base-200"
							onClick={() => navigate(detailsPath)}
						>
							Cancel
						</button>
						<Button type="submit" disabled={isDelivering}>
							Confirm delivery
						</Button>
					</div>
				</form>
				<TipCard
					title="The cash is checked."
					description="The delivery is recorded only when the cash collected is exactly the amount due. The signature, photo and location are not saved yet."
				/>
			</div>
		</div>
	);
}
