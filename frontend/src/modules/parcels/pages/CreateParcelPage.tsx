import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
	const { t } = useTranslation('parcels');
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
					title: t('create.created'),
					description: t('create.createdText', { tracking: parcel.trackingNumber }),
				});
				navigate(companyPath(`parcels/${parcel.id}`));
			},
			onError: (failure) => setError(failure.message),
		});
	};

	return (
		<div className="flex flex-col gap-6">
			<Link to={companyPath('parcels')} className="link link-hover w-fit text-sm">
				{t('common.backToDispatch')}
			</Link>
			<ModulePage title={t('create.title')} description={t('create.description')} />
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
							label={t('common.merchant')}
							required
							disabled={isOptionsPending}
							options={clients.map((client) => ({
								value: client.id,
								label: `${client.name} · ${client.code}`,
							}))}
						/>
						{!isOptionsPending && clients.length === 0 && (
							<p className="mt-1 text-xs text-[var(--color-slate)]">
								{t('create.noMerchants')}
							</p>
						)}
					</div>

					<fieldset className="flex flex-col gap-4">
						<legend className="mb-4 text-lg font-semibold">
							{t('create.recipient')}
						</legend>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Input
								name="recipientName"
								label={t('create.recipientName')}
								required
								maxLength={128}
								autoComplete="off"
							/>
							<Input
								name="recipientPhone"
								label={t('details.recipientPhone')}
								type="tel"
								required
								dir="ltr"
								autoComplete="off"
							/>
						</div>
						<Input
							name="recipientSecondaryPhone"
							label={t('create.secondPhone')}
							type="tel"
							dir="ltr"
							autoComplete="off"
						/>
						<Textarea
							name="deliveryAddress"
							label={t('details.deliveryAddress')}
							required
							rows={2}
						/>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Input
								name="deliveryCityZone"
								label={t('common.deliveryZone')}
								required
								maxLength={64}
								list="parcel-zones"
								autoComplete="off"
							/>
							<Input
								name="deliveryLandmark"
								label={t('create.landmark')}
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
						<legend className="mb-4 text-lg font-semibold">
							{t('create.package')}
						</legend>
						<Input
							name="weightKg"
							label={t('create.weight')}
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
							{t('details.fragile')}
						</label>
					</fieldset>

					<fieldset className="flex flex-col gap-4">
						<legend className="mb-4 text-lg font-semibold">
							{t('create.charges')}
						</legend>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Input
								name="deliveryFee"
								label={t('common.deliveryFee')}
								required
								type="number"
								min="0"
								step="0.01"
								defaultValue="0.00"
							/>
							<Input
								name="codAmount"
								label={t('common.codAmount')}
								required
								type="number"
								min="0"
								step="0.01"
								defaultValue="0.00"
							/>
						</div>
					</fieldset>

					<Textarea
						name="notes"
						label={t('create.pickupNotes')}
						rows={2}
						maxLength={2000}
					/>

					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className="btn border-0 bg-base-200"
							onClick={() => navigate(companyPath('parcels'))}
						>
							{t('common.cancel')}
						</button>
						<Button type="submit" disabled={isCreating || clients.length === 0}>
							{isCreating ? t('create.creating') : t('create.submit')}
						</Button>
					</div>
				</form>
				<TipCard title={t('create.tipTitle')} description={t('create.tipText')} />
			</div>
		</div>
	);
}
