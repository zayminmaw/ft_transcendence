import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, ModulePage, Select, Textarea, TipCard, useToast } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { merchants, zones } from '../data/sampleParcels';

const asOptions = (values: string[]) => values.map((value) => ({ value, label: value }));

// /parcels/new. Sample data until the parcel endpoints exist: saving only shows the toast.
export function CreateParcelPage() {
	const navigate = useNavigate();
	const companyPath = useCompanyPath();
	const { toast } = useToast();

	const onSubmit = (event: FormEvent) => {
		event.preventDefault();
		toast({
			variant: 'success',
			title: 'Parcel created',
			description: 'The pickup is scheduled and a waybill number was generated.',
		});
		navigate(companyPath('parcels'));
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
					<Select label="Merchant" required options={asOptions(merchants)} />

					<fieldset className="flex flex-col gap-4">
						<legend className="mb-4 text-lg font-semibold">Recipient</legend>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Input label="Recipient name" required autoComplete="off" />
							<Input
								label="Recipient phone"
								type="tel"
								required
								dir="ltr"
								autoComplete="off"
							/>
						</div>
						<Textarea label="Delivery address" required rows={2} />
						<Select label="Delivery zone" required options={asOptions(zones)} />
					</fieldset>

					<fieldset className="flex flex-col gap-4">
						<legend className="mb-4 text-lg font-semibold">Package</legend>
						<Input
							label="Weight (kg)"
							required
							type="number"
							min="0.01"
							step="0.01"
							defaultValue="0.50"
						/>
						<label className="flex items-center gap-2 text-sm font-medium">
							<input type="checkbox" className="checkbox checkbox-sm" />
							Fragile
						</label>
					</fieldset>

					<fieldset className="flex flex-col gap-4">
						<legend className="mb-4 text-lg font-semibold">Charges</legend>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Input
								label="Delivery fee"
								required
								type="number"
								min="0"
								step="0.01"
								defaultValue="0.00"
							/>
							<Input
								label="COD amount"
								required
								type="number"
								min="0"
								step="0.01"
								defaultValue="0.00"
							/>
						</div>
					</fieldset>

					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className="btn border-0 bg-base-200"
							onClick={() => navigate(companyPath('parcels'))}
						>
							Cancel
						</button>
						<Button type="submit">Create parcel</Button>
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
