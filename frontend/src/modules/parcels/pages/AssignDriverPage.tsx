import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Input, ModulePage, Textarea, TipCard, useToast } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { dispatchStatusLabels, parcelStatusLabels, vehicleLabel } from '../constants';
import { useParcelMutations } from '../hooks/useParcelMutations';
import { useAssignableParcels, useDispatchDrivers } from '../hooks/useParcels';

// /parcels/assign?parcel=<id>: send a sorted parcel, or a failed attempt again, out with a driver on duty. The parcel
// travels in the vehicle the driver has checked out and joins their run for today.
export function AssignDriverPage() {
	const navigate = useNavigate();
	const companyPath = useCompanyPath();
	const { toast } = useToast();
	const [searchParams] = useSearchParams();
	const { assignable, isAssignablePending } = useAssignableParcels();
	const { dispatchDrivers, isDriversPending } = useDispatchDrivers();
	const { assignParcel, isAssigning } = useParcelMutations();
	const [parcelId, setParcelId] = useState(searchParams.get('parcel') ?? '');
	const [driverId, setDriverId] = useState('');
	const [error, setError] = useState<string | null>(null);

	if (isAssignablePending || isDriversPending)
		return <span className="loading loading-spinner" aria-label="Loading" />;

	const parcel = assignable.find((item) => item.id === parcelId) ?? assignable[0];
	const driver = dispatchDrivers.find((item) => item.id === driverId) ?? dispatchDrivers[0];

	if (!parcel || !driver) {
		return (
			<div className="flex flex-col gap-6">
				<Link to={companyPath('parcels')} className="link link-hover w-fit text-sm">
					Back to dispatch
				</Link>
				<ModulePage
					title="Nothing to assign right now"
					description={
						parcel
							? 'No driver is on duty. Set a driver available on the drivers page.'
							: 'No parcel is sorted in the hub or waiting for another attempt.'
					}
				/>
			</div>
		);
	}

	const review = [
		{ label: 'Parcel stage', value: parcelStatusLabels[parcel.status] },
		...(parcel.driver ? [{ label: 'Previous owner', value: parcel.driver.name }] : []),
		{ label: 'New owner', value: driver.name },
		{ label: 'Vehicle', value: vehicleLabel(driver.vehicle) },
		{ label: 'Run', value: driver.run?.code ?? 'Opens a new run for today' },
	];

	return (
		<div className="flex flex-col gap-6">
			<ModulePage
				title="Assign a delivery driver"
				description="Review parcel ownership and vehicle pairing before dispatch."
			/>
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
										title: 'Driver assigned',
										description: `${saved.trackingNumber} is out with ${driver.name} on ${saved.run?.code}.`,
									});
									navigate(companyPath(`parcels/${saved.id}`));
								},
								onError: (failure) => setError(failure.message),
							},
						);
					}}
					className="flex flex-col gap-4 rounded-box border border-base-300 p-4 md:p-8"
				>
					{error && (
						<p role="alert" className="rounded-box bg-error/10 p-4 text-sm text-error">
							{error}
						</p>
					)}
					<div>
						<label htmlFor="parcel" className="mb-2 block text-sm font-medium">
							Parcel *
						</label>
						<select
							id="parcel"
							className="select w-full"
							value={parcel.id}
							onChange={(e) => setParcelId(e.target.value)}
						>
							{assignable.map((item) => (
								<option key={item.id} value={item.id}>
									{item.trackingNumber} · {item.recipientName} ·{' '}
									{parcelStatusLabels[item.status]}
								</option>
							))}
						</select>
					</div>
					<Input
						id="merchant"
						label="Merchant"
						value={parcel.client.name}
						readOnly
						className="border-0 bg-base-200"
					/>
					<Input
						id="zone"
						label="Delivery zone"
						value={`${parcel.deliveryCityZone} zone`}
						readOnly
						className="border-0 bg-base-200"
					/>
					<div>
						<label htmlFor="driver" className="mb-2 block text-sm font-medium">
							Selected driver *
						</label>
						<select
							id="driver"
							className="select w-full"
							value={driver.id}
							onChange={(e) => setDriverId(e.target.value)}
						>
							{dispatchDrivers.map((item) => (
								<option key={item.id} value={item.id}>
									{item.name} · {dispatchStatusLabels[item.dispatchStatus]}
									{item.zone && ` · ${item.zone} zone`}
								</option>
							))}
						</select>
						<p className="mt-1 text-xs text-[var(--color-slate)]">
							Only drivers who are on duty are listed.
						</p>
					</div>
					<Input
						id="asset"
						label="Assigned vehicle"
						value={vehicleLabel(driver.vehicle)}
						readOnly
						className="border-0 bg-base-200"
					/>
					<Input
						id="deliveryDetails"
						label="Delivery details"
						value={`COD ${parcel.codAmount} CUR · Delivery fee ${parcel.deliveryFee} CUR`}
						className="border-0 bg-base-200"
						readOnly
					/>
					<Textarea name="notes" label="Notes for the driver" rows={2} maxLength={2000} />
					<div className="mt-2 flex flex-col gap-2 sm:flex-row">
						<button
							type="button"
							className="btn border-0 bg-base-200"
							onClick={() => navigate(-1)}
						>
							Cancel
						</button>
						<button type="submit" className="btn btn-primary" disabled={isAssigning}>
							{isAssigning ? 'Assigning…' : 'Confirm assignment'}
						</button>
					</div>
				</form>
				<aside className="flex flex-col gap-6">
					<section className="rounded-box bg-base-200 p-6 md:p-8">
						<h2 className="text-lg font-semibold">Review this change</h2>
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
					<TipCard
						title="A clear handoff to the field."
						description="The parcel joins the driver's run for today, with the vehicle they have checked out. Reassigning a failed attempt keeps the previous owner in the history."
					/>
				</aside>
			</div>
		</div>
	);
}
