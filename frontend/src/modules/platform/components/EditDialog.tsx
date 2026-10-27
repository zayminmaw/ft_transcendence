import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, Input, useToast } from '@global-components';
import type { TenantDetails, UpdateTenantValues } from '../api';
import { useTenantMutations } from '../hooks/useTenantMutations';
import { editOrganizationSchema } from '../schemas/editOrganizationSchema';

export function EditDialog({ tenant, onClose }: { tenant: TenantDetails; onClose: () => void }) {
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

	return (
		<Dialog
			open
			onClose={onClose}
			title="Edit organization details"
			description="The slug stays the same: it is part of every company link."
			onSubmit={handleSubmit((values) =>
				updateTenant(
					{ tenantId: tenant.id, values },
					{
						onSuccess: () => {
							onClose();
							toast({ variant: 'success', title: 'Details saved' });
						},
					},
				),
			)}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={onClose}>
						Cancel
					</button>
					<button type="submit" className="btn btn-primary" disabled={isUpdating}>
						Save details
					</button>
				</>
			}
		>
			{updateError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{updateError.message}
				</p>
			)}
			<div className="flex flex-col gap-4">
				<Input
					label="Organization name"
					required
					error={errors.name?.message}
					{...register('name')}
				/>
				<Input
					label="Contact email"
					type="email"
					required
					error={errors.contactEmail?.message}
					{...register('contactEmail')}
				/>
				<Input
					label="Phone (optional)"
					type="tel"
					error={errors.contactPhone?.message}
					{...register('contactPhone')}
				/>
				<Input
					label="Address (optional)"
					error={errors.address?.message}
					{...register('address')}
				/>
			</div>
		</Dialog>
	);
}
