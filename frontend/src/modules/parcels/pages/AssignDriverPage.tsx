import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input, ModulePage, TipCard, useToast } from '@global-components';
import { drivers, findDriver, parcelStatusLabels, parcels } from '../data/sampleParcels';

// Only sorted parcels and failed attempts can be (re)assigned, and only to available drivers.
const assignableParcels = parcels.filter(
	(parcel) => parcel.status === 'in_hub_sorted' || parcel.status === 'failed_attempt',
);
const availableDrivers = drivers.filter((driver) => driver.status === 'available');

export function AssignDriverPage() {
	const navigate = useNavigate();
	const { toast } = useToast();
	const [searchParams] = useSearchParams();
	const [parcelId, setParcelId] = useState(searchParams.get('parcel') ?? assignableParcels[0].id);
	const [driverId, setDriverId] = useState(availableDrivers[0].id);

	const parcel = assignableParcels.find((item) => item.id === parcelId) ?? assignableParcels[0];
	const driver = findDriver(driverId) ?? availableDrivers[0];
	const currentDriver = findDriver(parcel.driverId);

	const review = [
		{ label: 'Parcel stage', value: parcelStatusLabels[parcel.status] },
		...(currentDriver ? [{ label: 'Previous owner', value: currentDriver.name }] : []),
		{ label: 'New owner', value: driver.name },
		{ label: 'Asset', value: driver.vehicle },
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
					onSubmit={(e) => {
						e.preventDefault();
						toast({
							variant: 'success',
							title: 'Driver assigned',
							description: `${parcel.tracking} is assigned to ${driver.name}.`,
						});
						navigate('/app/parcels');
					}}
					className="flex flex-col gap-4 rounded-box border border-base-300 p-4 md:p-8"
				>
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
							{assignableParcels.map((item) => (
								<option key={item.id} value={item.id}>
									{item.tracking} · {item.recipient} ·{' '}
									{parcelStatusLabels[item.status]}
								</option>
							))}
						</select>
					</div>
					<Input
						id="merchant"
						label="Merchant"
						value={parcel.merchant}
						readOnly
						className="border-0 bg-base-200"
					/>
					<Input
						id="zone"
						label="Delivery zone"
						value={`${parcel.zone} zone`}
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
							{availableDrivers.map((item) => (
								<option key={item.id} value={item.id}>
									{item.name} · Available · {item.zone} zone
								</option>
							))}
						</select>
						<p className="mt-1 text-xs text-[var(--color-slate)]">
							Only drivers who are available for dispatch are listed.
						</p>
					</div>
					<Input
						id="asset"
						label="Assigned asset"
						value={driver.vehicle}
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
					<div className="mt-2 flex flex-col gap-2 sm:flex-row">
						<button
							type="button"
							className="btn border-0 bg-base-200"
							onClick={() => navigate(-1)}
						>
							Cancel
						</button>
						<button type="submit" className="btn btn-primary">
							Confirm assignment
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
						description="The selected driver receives the assigned parcel. Driver access is limited to assigned work; this prototype does not simulate live routing."
					/>
				</aside>
			</div>
		</div>
	);
}
