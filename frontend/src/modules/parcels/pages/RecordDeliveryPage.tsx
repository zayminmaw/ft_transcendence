import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Input, ModulePage, Textarea, TipCard, useToast } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { IMAGE_TYPES, PDF_TYPE } from '@utils/upload';
import { ProofField } from '../components/ProofField';
import { SignaturePad } from '../components/SignaturePad';
import { useParcelMutations } from '../hooks/useParcelMutations';
import { useParcelDetails } from '../hooks/useParcels';
import { refusalMessage, useProofBusy } from '../hooks/useProofFile';
import { coordinatesLabel } from '../constants';

type Location =
	| { state: 'none' | 'locating' | 'unavailable' }
	| { state: 'found'; latitude: number; longitude: number };

const locationText = (location: Location) => {
	if (location.state === 'found') return coordinatesLabel(location.latitude, location.longitude);
	if (location.state === 'locating') return 'Locating…';
	if (location.state === 'unavailable')
		return 'Not available. You can still record the delivery.';
	return 'Not captured';
};

// /parcels/:parcelId/deliver: proof of delivery for a parcel out for delivery. Each file is uploaded as soon as it is
// chosen (or the signature used) and can be replaced or removed until the delivery is confirmed; then it is fixed.
export function RecordDeliveryPage() {
	const { parcelId = '' } = useParams();
	const navigate = useNavigate();
	const companyPath = useCompanyPath();
	const { toast } = useToast();
	const [location, setLocation] = useState<Location>({ state: 'none' });
	const { parcel, isParcelPending } = useParcelDetails(parcelId);
	const { deliverParcel, isDelivering } = useParcelMutations();
	const proofBusy = useProofBusy(parcelId);

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
	const ready = parcel.proof.signature !== null && parcel.proof.photo !== null;

	const captureLocation = () => {
		setLocation({ state: 'locating' });
		navigator.geolocation.getCurrentPosition(
			({ coords }) =>
				setLocation({
					state: 'found',
					latitude: coords.latitude,
					longitude: coords.longitude,
				}),
			() => setLocation({ state: 'unavailable' }),
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
						const form = new FormData(event.currentTarget);
						const notes = String(form.get('notes') ?? '').trim();
						const found = location.state === 'found' ? location : null;
						deliverParcel(
							{
								parcelId: parcel.id,
								values: {
									collectedAmount: String(
										form.get('collectedAmount') ?? '',
									).trim(),
									latitude: found?.latitude ?? null,
									longitude: found?.longitude ?? null,
									notes: notes || null,
								},
							},
							{
								onSuccess: () => {
									toast({
										variant: 'success',
										title: 'Delivery recorded',
										description: `${parcel.trackingNumber} is delivered with proof attached.`,
									});
									navigate(detailsPath);
								},
								onError: (error) =>
									toast({
										variant: 'error',
										title: "The delivery couldn't be recorded",
										description: refusalMessage(
											error,
											'Check your connection and try again.',
										),
									}),
							},
						);
					}}
					className="flex flex-col gap-6 rounded-box border border-base-300 p-4 md:p-8"
				>
					<Input
						label="Cash collected"
						name="collectedAmount"
						required
						inputMode="decimal"
						dir="ltr"
						defaultValue={parcel.codAmount}
						pattern="[0-9]{1,10}(\.[0-9]{1,2})?"
						title="Enter an amount with up to 10 digits and 2 decimal places."
					/>
					<ProofField
						parcelId={parcel.id}
						kind="signature"
						label="Recipient signature"
						required
						accept={IMAGE_TYPES}
						saved={parcel.proof.signature}
						picker={(send, disabled) => (
							<SignaturePad onSave={send} disabled={disabled} />
						)}
					/>
					<ProofField
						parcelId={parcel.id}
						kind="photo"
						label="Doorstep photo"
						hint="JPEG, PNG or WebP, up to 10 MB."
						required
						accept={IMAGE_TYPES}
						capture="environment"
						saved={parcel.proof.photo}
					/>
					<ProofField
						parcelId={parcel.id}
						kind="note"
						label="Signed delivery note"
						hint="Optional: a photo or PDF of the paper the recipient signed, up to 10 MB."
						accept={[...IMAGE_TYPES, PDF_TYPE]}
						saved={parcel.proof.note}
					/>
					<div>
						<p className="mb-2 text-sm font-medium">Delivery location</p>
						<div className="flex flex-wrap items-center gap-3">
							<button
								type="button"
								className="btn border-0 bg-base-200"
								disabled={location.state === 'locating'}
								onClick={captureLocation}
							>
								Capture location
							</button>
							<p role="status" className="text-sm text-[var(--color-slate)]">
								{locationText(location)}
							</p>
						</div>
					</div>
					<Textarea label="Notes" name="notes" maxLength={2000} />
					<div className="flex flex-col gap-2">
						<div className="flex flex-wrap gap-3">
							<button
								type="button"
								className="btn border-0 bg-base-200"
								onClick={() => navigate(detailsPath)}
							>
								Cancel
							</button>
							<Button type="submit" disabled={!ready || proofBusy || isDelivering}>
								{isDelivering ? 'Confirming…' : 'Confirm delivery'}
							</Button>
						</div>
						{!ready && (
							<p className="text-sm text-[var(--color-slate)]">
								Add the recipient signature and the doorstep photo to confirm.
							</p>
						)}
					</div>
				</form>
				<TipCard
					title="Proof stays with the parcel."
					description="Each file is saved as soon as you add it, and you can replace or remove it until you confirm. Once the delivery is confirmed, the signature, photo, note and location are kept with the parcel and shown in its details."
				/>
			</div>
		</div>
	);
}
