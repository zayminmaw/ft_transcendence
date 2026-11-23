import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
	const { t } = useTranslation('parcels');
	const { toast } = useToast();
	// A status to translate, or the captured coordinates.
	const [location, setLocation] = useState<
		| 'deliver.notCaptured'
		| 'deliver.locating'
		| 'deliver.locationUnavailable'
		| { coords: string }
	>('deliver.notCaptured');
	const { parcel, isParcelPending } = useParcelDetails(parcelId);

	if (isParcelPending)
		return <span className="loading loading-spinner" aria-label={t('common.loading')} />;
	if (parcel?.status !== 'out_for_delivery') {
		return <ModulePage title={t('deliver.cantTitle')} description={t('deliver.cantText')} />;
	}

	const detailsPath = companyPath(`parcels/${parcel.id}`);

	const captureLocation = () => {
		setLocation('deliver.locating');
		navigator.geolocation.getCurrentPosition(
			({ coords }) =>
				setLocation({
					coords: `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,
				}),
			() => setLocation('deliver.locationUnavailable'),
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
						toast({
							variant: 'success',
							title: t('deliver.recorded'),
							description: t('deliver.recordedText', {
								tracking: parcel.trackingNumber,
							}),
						});
						navigate(detailsPath);
					}}
					className="flex flex-col gap-6 rounded-box border border-base-300 p-4 md:p-8"
				>
					<SignaturePad />
					<div>
						<label htmlFor="doorstep-photo" className="mb-2 block text-sm font-medium">
							{t('deliver.photo')}
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
						<p className="mb-2 text-sm font-medium">{t('deliver.location')}</p>
						<div className="flex flex-wrap items-center gap-3">
							<button
								type="button"
								className="btn border-0 bg-base-200"
								onClick={captureLocation}
							>
								{t('deliver.capture')}
							</button>
							<p role="status" className="text-sm text-[var(--color-slate)]">
								{typeof location === 'string' ? (
									t(location)
								) : (
									// Latitude first, also on an Arabic page.
									<span dir="ltr">{location.coords}</span>
								)}
							</p>
						</div>
					</div>
					<Textarea label={t('common.notes')} />
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className="btn border-0 bg-base-200"
							onClick={() => navigate(detailsPath)}
						>
							{t('common.cancel')}
						</button>
						<Button type="submit">{t('deliver.confirm')}</Button>
					</div>
				</form>
				<TipCard title={t('deliver.tipTitle')} description={t('deliver.tipText')} />
			</div>
		</div>
	);
}
