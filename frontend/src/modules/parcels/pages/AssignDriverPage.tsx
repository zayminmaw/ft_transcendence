import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Input, ModulePage, Textarea, TipCard, useToast } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { ASSIGNABLE_STATUSES, vehicleLabel } from '../constants';
import { useParcelMutations } from '../hooks/useParcelMutations';
import { useAssignableParcels, useDispatchDrivers, useParcelDetails } from '../hooks/useParcels';
import { parcelErrorKey } from '../errors';

// /parcels/assign?parcel=<id>: send a sorted parcel, or a failed attempt again, out with a driver on duty. The parcel
// travels in the vehicle the driver has checked out and joins their run for today.
export function AssignDriverPage() {
	const { t } = useTranslation('parcels');
	const navigate = useNavigate();
	const companyPath = useCompanyPath();
	const { toast } = useToast();
	const [searchParams] = useSearchParams();
	const requestedId = searchParams.get('parcel') ?? '';
	const { assignable, isAssignablePending } = useAssignableParcels();
	// The parcel the link names is loaded on its own: it may be past the oldest 50 the choice lists.
	const { parcel: requested, isParcelPending } = useParcelDetails(
		requestedId,
		requestedId !== '',
	);
	const { dispatchDrivers, isDriversPending } = useDispatchDrivers();
	const { assignParcel, isAssigning } = useParcelMutations();
	const [parcelId, setParcelId] = useState(requestedId);
	const [driverId, setDriverId] = useState('');
	const [error, setError] = useState<ReturnType<typeof parcelErrorKey> | null>(null);

	if (isAssignablePending || isParcelPending || isDriversPending)
		return <span className="loading loading-spinner" aria-label={t('common.loading')} />;

	const requestedCanGo = requested && ASSIGNABLE_STATUSES.includes(requested.status);
	const choices =
		requestedCanGo && !assignable.some((item) => item.id === requested.id)
			? [requested, ...assignable]
			: assignable;
	// A parcel the link names is never swapped for another: the first one is only the default when none is named.
	const parcel = parcelId ? choices.find((item) => item.id === parcelId) : choices[0];
	const driver = dispatchDrivers.find((item) => item.id === driverId) ?? dispatchDrivers[0];

	if (!parcel && parcelId) {
		return (
			<div className="flex flex-col gap-6">
				<Link
					to={companyPath(requested ? `parcels/${requested.id}` : 'parcels')}
					className="link link-hover w-fit text-sm"
				>
					{requested ? t('assign.backToParcel') : t('common.backToDispatch')}
				</Link>
				<ModulePage
					title={t('assign.cantTitle')}
					description={
						requested
							? t('assign.cantStatus', {
									tracking: requested.trackingNumber,
									status: t(`status.${requested.status}`),
								})
							: t('assign.notFound')
					}
				/>
			</div>
		);
	}

	if (!parcel || !driver) {
		return (
			<div className="flex flex-col gap-6">
				<Link to={companyPath('parcels')} className="link link-hover w-fit text-sm">
					{t('common.backToDispatch')}
				</Link>
				<ModulePage
					title={t('assign.nothingTitle')}
					description={parcel ? t('common.noDriverOnDuty') : t('assign.noParcel')}
				/>
			</div>
		);
	}

	const review = [
		{ label: t('assign.stage'), value: t(`status.${parcel.status}`) },
		...(parcel.driver ? [{ label: t('assign.previousOwner'), value: parcel.driver.name }] : []),
		{ label: t('assign.newOwner'), value: driver.name },
		{ label: t('common.vehicle'), value: vehicleLabel(t, driver.vehicle) },
		{ label: t('common.run'), value: driver.run?.code ?? t('assign.newRun') },
	];

	return (
		<div className="flex flex-col gap-6">
			<ModulePage title={t('assign.title')} description={t('assign.description')} />
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<form
					id="assign-driver-form"
					onSubmit={(event) => {
						event.preventDefault();
						setError(null);
						// As typed: the API trims the notes and drops empty ones.
						const notes = String(new FormData(event.currentTarget).get('notes') ?? '');
						assignParcel(
							{ parcelId: parcel.id, driverId: driver.id, notes },
							{
								onSuccess: (saved) => {
									toast({
										variant: 'success',
										title: t('assign.assigned'),
										description: t('assign.assignedText', {
											tracking: saved.trackingNumber,
											driver: driver.name,
											run: saved.run?.code,
										}),
									});
									navigate(companyPath(`parcels/${saved.id}`));
								},
								onError: (failure) => setError(parcelErrorKey(failure)),
							},
						);
					}}
					className="flex flex-col gap-4 rounded-box border border-base-300 p-4 md:p-8"
				>
					{error && (
						<p role="alert" className="rounded-box bg-error/10 p-4 text-sm text-error">
							{t(error)}
						</p>
					)}
					<div>
						<label htmlFor="parcel" className="mb-2 block text-sm font-medium">
							{t('assign.parcel')}
						</label>
						<select
							id="parcel"
							className="select w-full"
							value={parcel.id}
							onChange={(e) => setParcelId(e.target.value)}
						>
							{choices.map((item) => (
								<option key={item.id} value={item.id}>
									{item.trackingNumber} · {item.recipientName} ·{' '}
									{t(`status.${item.status}`)}
								</option>
							))}
						</select>
					</div>
					<Input
						id="merchant"
						label={t('common.merchant')}
						value={parcel.client.name}
						readOnly
						className="border-0 bg-base-200"
					/>
					<Input
						id="zone"
						label={t('common.deliveryZone')}
						value={t('common.zone', { zone: parcel.deliveryCityZone })}
						readOnly
						className="border-0 bg-base-200"
					/>
					<div>
						<label htmlFor="driver" className="mb-2 block text-sm font-medium">
							{t('assign.driver')}
						</label>
						<select
							id="driver"
							className="select w-full"
							value={driver.id}
							onChange={(e) => setDriverId(e.target.value)}
						>
							{dispatchDrivers.map((item) => (
								<option key={item.id} value={item.id}>
									{item.name} · {t(`dispatchStatus.${item.dispatchStatus}`)}
									{item.zone && ` · ${t('common.zone', { zone: item.zone })}`}
								</option>
							))}
						</select>
						<p className="mt-1 text-xs text-[var(--color-slate)]">
							{t('assign.driverNote')}
						</p>
					</div>
					<Input
						id="asset"
						label={t('assign.vehicle')}
						value={vehicleLabel(t, driver.vehicle)}
						readOnly
						className="border-0 bg-base-200"
					/>
					<Input
						id="deliveryDetails"
						label={t('assign.deliveryDetails')}
						value={t('assign.deliveryDetailsValue', {
							cod: parcel.codAmount,
							fee: parcel.deliveryFee,
						})}
						className="border-0 bg-base-200"
						readOnly
					/>
					<Textarea name="notes" label={t('assign.notes')} rows={2} maxLength={2000} />
					<div className="mt-2 flex flex-col gap-2 sm:flex-row">
						<button
							type="button"
							className="btn border-0 bg-base-200"
							onClick={() => navigate(-1)}
						>
							{t('common.cancel')}
						</button>
						<button type="submit" className="btn btn-primary" disabled={isAssigning}>
							{isAssigning ? t('assign.assigning') : t('assign.confirm')}
						</button>
					</div>
				</form>
				<aside className="flex flex-col gap-6">
					<section className="rounded-box bg-base-200 p-6 md:p-8">
						<h2 className="text-lg font-semibold">{t('assign.review')}</h2>
						<dl className="mt-6 flex flex-col gap-5">
							{review.map((item) => (
								<div key={item.label}>
									<dt className="text-sm text-[var(--color-slate)]">
										{item.label}
									</dt>
									<dd className="mt-1 text-lg font-semibold break-words">
										{item.value}
									</dd>
								</div>
							))}
						</dl>
					</section>
					<TipCard title={t('assign.tipTitle')} description={t('assign.tipText')} />
				</aside>
			</div>
		</div>
	);
}
