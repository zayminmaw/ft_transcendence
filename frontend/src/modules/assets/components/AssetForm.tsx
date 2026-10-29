import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Select, Textarea, useToast } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import type { Asset } from '../api';
import { ASSET_CATEGORIES, ASSET_CONDITIONS, VEHICLE_CATEGORIES } from '../constants';
import { useAssetMutations } from '../hooks/useAssetMutations';
import { assetSchema, type AssetFormOutput, type AssetFormValues } from '../schemas/assetSchema';
import { toAssetValues } from '../utils/assetFormValues';
import { assetErrorField, assetErrorKey } from '../utils/errors';

// The asset fields, for adding an asset (no `asset`) or editing one (assets.create). Saving opens the asset's page.
// Vehicle fields show only for motorcycles and vans; an asset is retired by setting it decommissioned.
export function AssetForm({
	asset,
	defaultValues,
}: {
	asset?: Asset;
	defaultValues: AssetFormValues;
}) {
	const { t } = useTranslation('assets');
	const navigate = useNavigate();
	const companyPath = useCompanyPath();
	const { toast } = useToast();
	const { createAsset, isCreating, createError, updateAsset, isUpdating, updateError } =
		useAssetMutations();
	const saveError = asset ? updateError : createError;
	const isSaving = asset ? isUpdating : isCreating;
	const {
		register,
		handleSubmit,
		setError,
		control,
		formState: { errors },
	} = useForm<AssetFormValues, unknown, AssetFormOutput>({
		resolver: zodResolver(assetSchema),
		defaultValues,
	});
	const category = useWatch({ control, name: 'category' });
	const vehicle = VEHICLE_CATEGORIES.includes(category);
	const fieldError = (message?: string) => message && t(message as ParseKeys<'assets'>);
	const backTo = asset ? companyPath(`assets/${asset.id}`) : companyPath('assets');
	const formError = saveError && !assetErrorField(saveError);
	// A new asset can't start decommissioned.
	const conditions = asset
		? ASSET_CONDITIONS
		: ASSET_CONDITIONS.filter((value) => value !== 'decommissioned');

	const onSubmit = handleSubmit((values) => {
		const assetValues = toAssetValues(values);
		const handlers = {
			onSuccess: (saved: Asset) => {
				toast({
					variant: 'success',
					title: asset ? t('form.updated') : t('form.created', { name: saved.assetName }),
				});
				navigate(companyPath(`assets/${saved.id}`));
			},
			onError: (error: unknown) => {
				const field = assetErrorField(error);
				if (field)
					setError(field, { message: assetErrorKey(error) }, { shouldFocus: true });
			},
		};
		if (asset) updateAsset({ assetId: asset.id, values: assetValues }, handlers);
		else createAsset(assetValues, handlers);
	});

	return (
		<form
			noValidate
			onSubmit={onSubmit}
			className="flex flex-col gap-8 rounded-box border border-base-300 p-4 md:p-8"
		>
			{formError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(assetErrorKey(saveError))}
				</p>
			)}

			<fieldset className="flex flex-col gap-4">
				<legend className="mb-4 text-lg font-semibold">{t('form.asset')}</legend>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Input
						label={t('fields.assetTag')}
						required
						dir="ltr"
						autoComplete="off"
						placeholder="AST-009"
						error={fieldError(errors.assetTag?.message)}
						{...register('assetTag')}
					/>
					<Input
						label={t('fields.assetName')}
						required
						autoComplete="off"
						placeholder={t('form.namePlaceholder')}
						error={fieldError(errors.assetName?.message)}
						{...register('assetName')}
					/>
					<Select
						label={t('fields.category')}
						options={ASSET_CATEGORIES.map((value) => ({
							value,
							label: t(`category.${value}`),
						}))}
						{...register('category')}
					/>
					<Select
						label={t('fields.currentCondition')}
						error={fieldError(errors.currentCondition?.message)}
						options={conditions.map((value) => ({
							value,
							label: t(`condition.${value}`),
						}))}
						{...register('currentCondition')}
					/>
				</div>
				<Textarea
					label={t('fields.notes')}
					rows={2}
					error={fieldError(errors.notes?.message)}
					{...register('notes')}
				/>
			</fieldset>

			<fieldset className="flex flex-col gap-4">
				<legend className="mb-4 text-lg font-semibold">{t('form.value')}</legend>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Input
						label={t('fields.acquisitionCost')}
						inputMode="decimal"
						dir="ltr"
						error={fieldError(errors.acquisitionCost?.message)}
						{...register('acquisitionCost')}
					/>
					<Input
						label={t('fields.currentBookValue')}
						inputMode="decimal"
						dir="ltr"
						error={fieldError(errors.currentBookValue?.message)}
						{...register('currentBookValue')}
					/>
				</div>
			</fieldset>

			{vehicle && (
				<fieldset className="flex flex-col gap-4">
					<legend className="mb-4 text-lg font-semibold">{t('form.vehicle')}</legend>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<Input
							label={t('fields.licensePlate')}
							dir="ltr"
							autoComplete="off"
							error={fieldError(errors.licensePlate?.message)}
							{...register('licensePlate')}
						/>
						<Input
							label={t('fields.vin')}
							dir="ltr"
							autoComplete="off"
							error={fieldError(errors.vin?.message)}
							{...register('vin')}
						/>
						<Input
							label={t('fields.insurancePolicyNumber')}
							dir="ltr"
							autoComplete="off"
							error={fieldError(errors.insurancePolicyNumber?.message)}
							{...register('insurancePolicyNumber')}
						/>
						<Input
							label={t('fields.roadTaxExpiry')}
							type="date"
							error={fieldError(errors.roadTaxExpiry?.message)}
							{...register('roadTaxExpiry')}
						/>
					</div>
				</fieldset>
			)}

			<div className="flex flex-wrap gap-3">
				<button
					type="button"
					className="btn btn-ghost bg-base-200"
					onClick={() => navigate(backTo)}
				>
					{t('form.cancel')}
				</button>
				<Button type="submit" disabled={isSaving}>
					{isSaving && (
						<span className="loading loading-spinner loading-sm" aria-hidden="true" />
					)}
					{asset ? t('form.save') : t('form.submit')}
				</Button>
			</div>
		</form>
	);
}
