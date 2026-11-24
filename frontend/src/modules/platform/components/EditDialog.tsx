import type { ParseKeys } from 'i18next';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, Input, useToast } from '@global-components';
import type { TenantDetails, UpdateTenantValues } from '../api';
import { useTenantMutations } from '../hooks/useTenantMutations';
import { editOrganizationSchema } from '../schemas/editOrganizationSchema';
import { platformErrorKey } from '../errors';

export function EditDialog({ tenant, onClose }: { tenant: TenantDetails; onClose: () => void }) {
	const { t } = useTranslation('platform');
	const { toast } = useToast();
	const { updateTenant, isUpdating, updateError } = useTenantMutations();
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<UpdateTenantValues>({
		resolver: zodResolver(editOrganizationSchema),
		defaultValues: {
			name: tenant.name,
			contactEmail: tenant.contactEmail,
			contactPhone: tenant.contactPhone ?? '',
			address: tenant.address ?? '',
		},
	});
	const fieldError = (message?: string) => message && t(message as ParseKeys<'platform'>);

	return (
		<Dialog
			open
			onClose={onClose}
			title={t('edit.title')}
			description={t('edit.description')}
			onSubmit={handleSubmit((values) =>
				updateTenant(
					{ tenantId: tenant.id, values },
					{
						onSuccess: () => {
							onClose();
							toast({ variant: 'success', title: t('edit.saved') });
						},
					},
				),
			)}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={onClose}>
						{t('common.cancel')}
					</button>
					<button type="submit" className="btn btn-primary" disabled={isUpdating}>
						{t('edit.save')}
					</button>
				</>
			}
		>
			{updateError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(platformErrorKey(updateError))}
				</p>
			)}
			<div className="flex flex-col gap-4">
				<Input
					label={t('fields.organizationName')}
					required
					error={fieldError(errors.name?.message)}
					{...register('name')}
				/>
				<Input
					label={t('fields.contactEmail')}
					type="email"
					required
					error={fieldError(errors.contactEmail?.message)}
					{...register('contactEmail')}
				/>
				<Input
					label={t('fields.phoneOptional')}
					type="tel"
					error={fieldError(errors.contactPhone?.message)}
					{...register('contactPhone')}
				/>
				<Input
					label={t('fields.addressOptional')}
					error={fieldError(errors.address?.message)}
					{...register('address')}
				/>
			</div>
		</Dialog>
	);
}
