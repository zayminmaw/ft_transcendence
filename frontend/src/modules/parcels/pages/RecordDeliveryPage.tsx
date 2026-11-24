import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Input, ModulePage, Textarea, TipCard, useToast } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { IMAGE_TYPES, PDF_TYPE } from '@utils/upload';
import { ProofField } from '../components/ProofField';
import { SignaturePad } from '../components/SignaturePad';
import { useParcelMutations } from '../hooks/useParcelMutations';
import { useParcelDetails } from '../hooks/useParcels';
import { useProofBusy } from '../hooks/useProofFile';
import { coordinatesLabel } from '../constants';
import { parcelFormError } from '../errors';

type Location =
	| { state: 'none' | 'locating' | 'unavailable' }
	| { state: 'found'; latitude: number; longitude: number };

const AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

// /parcels/:parcelId/deliver: proof of delivery for a parcel out for delivery. Each file is uploaded as soon as it is
// chosen (or the signature used) and can be replaced or removed until the delivery is confirmed; then it is fixed.
export function RecordDeliveryPage() {
	const { parcelId = '' } = useParams();
	const navigate = useNavigate();
	const companyPath = useCompanyPath();
	const { t } = useTranslation('parcels');
	const { toast } = useToast();
	const [location, setLocation] = useState<Location>({ state: 'none' });
	const [error, setError] = useState<Error | 'amount' | null>(null);
	const { parcel, isParcelPending } = useParcelDetails(parcelId);
	const { deliverParcel, isDelivering } = useParcelMutations();
	const proofBusy = useProofBusy(parcelId);

	if (isParcelPending)
		return <span className="loading loading-spinner" aria-label={t('common.loading')} />;
	if (parcel?.status !== 'out_for_delivery' || !parcel.canRecordDelivery) {
		return <ModulePage title={t('deliver.cantTitle')} description={t('deliver.cantText')} />;
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
				{t('deliver.back', { tracking: parcel.trackingNumber })}
			</Link>
			<ModulePage
				title={t('deliver.title', { tracking: parcel.trackingNumber })}
				description={t('deliver.description', {
					recipient: parcel.recipientName,
					address: parcel.deliveryAddress,
					cod: parcel.codAmount,
				})}
			/>
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<form
					onSubmit={(event) => {
						event.preventDefault();
						setError(null);
						const form = new FormData(event.currentTarget);
						const collectedAmount = String(form.get('collectedAmount') ?? '').trim();
						if (!AMOUNT_PATTERN.test(collectedAmount)) {
							setError('amount');
							return;
						}
						const notes = String(form.get('notes') ?? '').trim();
						const found = location.state === 'found' ? location : null;
						deliverParcel(
							{
								parcelId: parcel.id,
								values: {
									collectedAmount,
									latitude: found?.latitude ?? null,
									longitude: found?.longitude ?? null,
									notes: notes || null,
								},
							},
							{
								onSuccess: () => {
									toast({
										variant: 'success',
										title: t('deliver.recorded'),
										description: t('deliver.recordedText', {
											tracking: parcel.trackingNumber,
										}),
									});
									navigate(detailsPath);
								},
								onError: (failure) => setError(failure),
							},
						);
					}}
					className="flex flex-col gap-6 rounded-box border border-base-300 p-4 md:p-8"
				>
					{error && (
						<p role="alert" className="rounded-box bg-error/10 p-4 text-sm text-error">
							{error === 'amount'
								? t('deliver.amountError')
								: parcelFormError(t, error)}
						</p>
					)}
					<Input
						label={t('deliver.cashCollected')}
						name="collectedAmount"
						required
						inputMode="decimal"
						dir="ltr"
						placeholder={parcel.codAmount}
						pattern="[0-9]{1,10}(\.[0-9]{1,2})?"
						title={t('deliver.amountTitle')}
					/>
					<ProofField
						parcelId={parcel.id}
						kind="signature"
						label={t('deliver.signature')}
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
						label={t('deliver.photo')}
						hint={t('deliver.photoHint')}
						required
						accept={IMAGE_TYPES}
						capture="environment"
						saved={parcel.proof.photo}
					/>
					<ProofField
						parcelId={parcel.id}
						kind="note"
						label={t('deliver.note')}
						hint={t('deliver.noteHint')}
						accept={[...IMAGE_TYPES, PDF_TYPE]}
						saved={parcel.proof.note}
					/>
					<div>
						<p className="mb-2 text-sm font-medium">{t('deliver.location')}</p>
						<div className="flex flex-wrap items-center gap-3">
							<button
								type="button"
								className="btn border-0 bg-base-200"
								disabled={location.state === 'locating'}
								onClick={captureLocation}
							>
								{t('deliver.capture')}
							</button>
							<p role="status" className="text-sm text-[var(--color-slate)]">
								{location.state === 'found' ? (
									<span dir="ltr">
										{coordinatesLabel(location.latitude, location.longitude)}
									</span>
								) : (
									t(
										location.state === 'locating'
											? 'deliver.locating'
											: location.state === 'unavailable'
												? 'deliver.locationUnavailable'
												: 'deliver.notCaptured',
									)
								)}
							</p>
						</div>
					</div>
					<Textarea label={t('common.notes')} name="notes" maxLength={2000} />
					<div className="flex flex-col gap-2">
						<div className="flex flex-wrap gap-3">
							<button
								type="button"
								className="btn border-0 bg-base-200"
								onClick={() => navigate(detailsPath)}
							>
								{t('common.cancel')}
							</button>
							<Button type="submit" disabled={!ready || proofBusy || isDelivering}>
								{isDelivering ? t('deliver.confirming') : t('deliver.confirm')}
							</Button>
						</div>
						{!ready && (
							<p className="text-sm text-[var(--color-slate)]">
								{t('deliver.requiredProof')}
							</p>
						)}
					</div>
				</form>
				<TipCard title={t('deliver.tipTitle')} description={t('deliver.proofTip')} />
			</div>
		</div>
	);
}
