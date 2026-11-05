import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, ModulePage, Select, Textarea, TipCard, useToast } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import type { NewParcelValues } from '../api';
import { useParcelMutations } from '../hooks/useParcelMutations';
import { useParcelFormOptions } from '../hooks/useParcels';

// The fields as typed: the API trims them and clears an optional one left empty. The checkbox is sent only when
// ticked, so it becomes a boolean here.
function valuesOf(form: HTMLFormElement): NewParcelValues {
	const data = new FormData(form);
	return {
		...(Object.fromEntries(data) as Omit<NewParcelValues, 'isFragile'>),
		isFragile: data.get('isFragile') === 'on',
	};
}

// /parcels/new: a waybill for one of the company's merchants, with its pickup scheduled. The API draws the tracking
// number.
export function CreateParcelPage() {
	const navigate = useNavigate();
	const companyPath = useCompanyPath();
	const { toast } = useToast();
	const { options, isOptionsPending } = useParcelFormOptions();
	const { createParcel, isCreating } = useParcelMutations();
	const [error, setError] = useState<string | null>(null);
	const clients = options?.clients ?? [];

	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);
		createParcel(valuesOf(event.currentTarget), {
			onSuccess: (parcel) => {
				toast({
					variant: 'success',
					title: 'Parcel created',
					description: `${parcel.trackingNumber} is waiting for pickup.`,
				});
				navigate(companyPath(`parcels/${parcel.id}`));
			},
			onError: (failure) => setError(failure.message),
		});
	};

	return (
		<div className="flex flex-col gap-6">
			<Link to={companyPath('parcels')} className="link link-hover w-fit text-sm">
				Back to dispatch
			</Link>
			<ModulePage
				title="New parcel"
				description="Create a waybill and schedule its pickup from the merchant."
			/>
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<form
					onSubmit={onSubmit}
					className="flex flex-col gap-8 rounded-box border border-base-300 p-4 md:p-8"
				>
					{error && (
						<p role="alert" className="rounded-box bg-error/10 p-4 text-sm text-error">
							{error}
						</p>
					)}
					<div>
						<Select
							name="clientId"
							label="Merchant"
							required
							disabled={isOptionsPending}
							options={clients.map((client) => ({
								value: client.id,
								label: `${client.name} · ${client.code}`,
							}))}
						/>
						{!isOptionsPending && clients.length === 0 && (
							<p className="mt-1 text-xs text-[var(--color-slate)]">
								This company has no active merchants yet. Add a client first.
							</p>
						)}
					</div>

					<fieldset className="flex flex-col gap-4">
						<legend className="mb-4 text-lg font-semibold">Recipient</legend>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Input
								name="recipientName"
								label="Recipient name"
								required
								maxLength={128}
								autoComplete="off"
							/>
							<Input
								name="recipientPhone"
								label="Recipient phone"
								type="tel"
								required
								dir="ltr"
								autoComplete="off"
							/>
						</div>
						<Input
							name="recipientSecondaryPhone"
							label="Second phone"
							type="tel"
							dir="ltr"
							autoComplete="off"
						/>
						<Textarea
							name="deliveryAddress"
							label="Delivery address"
							required
							rows={2}
						/>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Input
								name="deliveryCityZone"
								label="Delivery zone"
								required
								maxLength={64}
								list="parcel-zones"
								autoComplete="off"
							/>
							<Input
								name="deliveryLandmark"
								label="Landmark"
								maxLength={128}
								autoComplete="off"
							/>
						</div>
						<datalist id="parcel-zones">
							{options?.zones.map((zone) => (
								<option key={zone} value={zone} />
							))}
						</datalist>
					</fieldset>

					<fieldset className="flex flex-col gap-4">
						<legend className="mb-4 text-lg font-semibold">Package</legend>
						<Input
							name="weightKg"
							label="Weight (kg)"
							required
							type="number"
							min="0.01"
							max="999999.99"
							step="0.01"
							defaultValue="0.50"
						/>
						<label className="flex items-center gap-2 text-sm font-medium">
							<input
								name="isFragile"
								type="checkbox"
								className="checkbox checkbox-sm"
							/>
							Fragile
						</label>
					</fieldset>

					<fieldset className="flex flex-col gap-4">
						<legend className="mb-4 text-lg font-semibold">Charges</legend>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Input
								name="deliveryFee"
								label="Delivery fee"
								required
								type="number"
								min="0"
								step="0.01"
								defaultValue="0.00"
							/>
							<Input
								name="codAmount"
								label="COD amount"
								required
								type="number"
								min="0"
								step="0.01"
								defaultValue="0.00"
							/>
						</div>
					</fieldset>

					<Textarea name="notes" label="Pickup notes" rows={2} maxLength={2000} />

					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className="btn border-0 bg-base-200"
							onClick={() => navigate(companyPath('parcels'))}
						>
							Cancel
						</button>
						<Button type="submit" disabled={isCreating || clients.length === 0}>
							{isCreating ? 'Creating…' : 'Create parcel'}
						</Button>
					</div>
				</form>
				<TipCard
					title="One waybill per parcel."
					description="The tracking number is generated when you save. It goes on the barcode and is what the recipient uses to track the parcel."
				/>
			</div>
		</div>
	);
}
