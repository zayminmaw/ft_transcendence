import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, ModulePage, Textarea, TipCard, useToast } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { SignaturePad } from '../components/SignaturePad';
import { useParcelDetails } from '../hooks/useParcels';

// /parcels/:parcelId/deliver. The parcel is real; recording proof of delivery comes with the POD endpoint, so saving
// only shows the toast for now.
export function RecordDeliveryPage() {
	const { parcelId = '' } = useParams();
	const navigate = useNavigate();
	const companyPath = useCompanyPath();
	const { toast } = useToast();
	const [location, setLocation] = useState('Not captured');
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
						toast({
							variant: 'success',
							title: 'Delivery recorded',
							description: `${parcel.trackingNumber} is delivered with proof attached.`,
						});
						navigate(detailsPath);
					}}
					className="flex flex-col gap-6 rounded-box border border-base-300 p-4 md:p-8"
				>
					<SignaturePad />
					<div>
						<label htmlFor="doorstep-photo" className="mb-2 block text-sm font-medium">
							Doorstep photo *
						</label>
						<input
							id="doorstep-photo"
							type="file"
							required
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
					<Textarea label="Notes" />
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className="btn border-0 bg-base-200"
							onClick={() => navigate(detailsPath)}
						>
							Cancel
						</button>
						<Button type="submit">Confirm delivery</Button>
					</div>
				</form>
				<TipCard
					title="Proof stays with the parcel."
					description="The signature, photo and location are attached to the parcel and shown in its details."
				/>
			</div>
		</div>
	);
}
