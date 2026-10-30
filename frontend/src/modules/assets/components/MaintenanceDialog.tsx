import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Dialog, Input, Select, Textarea, useToast } from '@global-components';
import type { Asset } from '../api';
import { MAINTENANCE_DEFAULT_VALUES, RETURN_CONDITIONS } from '../constants';
import { useAssetMutations } from '../hooks/useAssetMutations';
import {
	maintenanceSchema,
	type MaintenanceFormOutput,
	type MaintenanceFormValues,
} from '../schemas/maintenanceSchema';
import { assetErrorKey } from '../utils/errors';
import { toMaintenanceValues } from '../utils/maintenanceFormValues';

// Records a service, repair or inspection, and the condition the asset is in afterwards (assets.log_maintenance).
// Mounted only while open, so every opening starts from today's date.
export function MaintenanceDialog({ asset, onClose }: { asset: Asset; onClose: () => void }) {
	const { t } = useTranslation('assets');
	const { toast } = useToast();
	const { logAssetMaintenance, isLogging, logError } = useAssetMutations();
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<MaintenanceFormValues, unknown, MaintenanceFormOutput>({
		resolver: zodResolver(maintenanceSchema),
		// 'YYYY-MM-DD' in the browser's time zone.
		defaultValues: {
			...MAINTENANCE_DEFAULT_VALUES,
			serviceDate: new Date().toLocaleDateString('en-CA'),
		},
	});
	const fieldError = (message?: string) => message && t(message as ParseKeys<'assets'>);

	return (
		<Dialog
			open
			onClose={onClose}
			title={t('maintenance.title', { name: asset.assetName })}
			description={t('maintenance.description')}
			onSubmit={handleSubmit((values) =>
				logAssetMaintenance(
					{
						assetId: asset.id,
						values: toMaintenanceValues(values),
					},
					{
						onSuccess: () => {
							onClose();
							toast({
								variant: 'success',
								title: t('maintenance.done', { name: asset.assetName }),
							});
						},
					},
				),
			)}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={onClose}>
						{t('form.cancel')}
					</button>
					<button type="submit" className="btn btn-neutral" disabled={isLogging}>
						{t('maintenance.submit')}
					</button>
				</>
			}
		>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<Input
					label={t('maintenance.serviceType')}
					required
					autoComplete="off"
					placeholder={t('maintenance.serviceTypePlaceholder')}
					containerClassName="sm:col-span-2"
					error={fieldError(errors.serviceType?.message)}
					{...register('serviceType')}
				/>
				<Input
					label={t('maintenance.serviceDate')}
					type="date"
					required
					error={fieldError(errors.serviceDate?.message)}
					{...register('serviceDate')}
				/>
				<Input
					label={t('maintenance.serviceCost')}
					inputMode="decimal"
					dir="ltr"
					error={fieldError(errors.serviceCost?.message)}
					{...register('serviceCost')}
				/>
				<Input
					label={t('maintenance.vendor')}
					autoComplete="off"
					error={fieldError(errors.vendorServiceCenter?.message)}
					{...register('vendorServiceCenter')}
				/>
				<Input
					label={t('maintenance.nextServiceDue')}
					type="date"
					error={fieldError(errors.nextServiceDue?.message)}
					{...register('nextServiceDue')}
				/>
				<Select
					label={t('maintenance.condition')}
					containerClassName="sm:col-span-2"
					options={RETURN_CONDITIONS.map((value) => ({
						value,
						label: t(`condition.${value}`),
					}))}
					{...register('condition')}
				/>
			</div>
			<Textarea
				label={t('maintenance.notes')}
				rows={2}
				error={fieldError(errors.notes?.message)}
				{...register('notes')}
			/>
			{logError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(assetErrorKey(logError))}
				</p>
			)}
		</Dialog>
	);
}
