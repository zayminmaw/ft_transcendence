import { useState } from 'react';
import { Dialog, useToast } from '@global-components';
import type { TenantDetails } from '../api';
import { useTenantMutations } from '../hooks/useTenantMutations';

export function StatusDialog({
	tenant,
	open,
	onClose,
}: {
	tenant: TenantDetails;
	open: boolean;
	onClose: () => void;
}) {
	const { toast } = useToast();
	const { setTenantActive, isSettingActive, setActiveError, resetSetActive } =
		useTenantMutations();
	const [reason, setReason] = useState('');
	const suspended = !tenant.isActive;
	const close = () => {
		setReason('');
		resetSetActive();
		onClose();
	};

	return (
		<Dialog
			open={open}
			onClose={close}
			title={suspended ? `Reactivate ${tenant.name}?` : `Suspend ${tenant.name}?`}
			description={
				suspended
					? 'Members with active memberships regain access to this company.'
					: 'All members lose access to this company. Their accounts and other company memberships are not affected.'
			}
			onSubmit={(event) => {
				event.preventDefault();
				setTenantActive(
					{ tenantId: tenant.id, active: suspended, reason },
					{
						onSuccess: () => {
							close();
							toast({
								variant: 'success',
								title: suspended ? 'Tenant reactivated' : 'Tenant suspended',
							});
						},
					},
				);
			}}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={close}>
						Cancel
					</button>
					<button
						type="submit"
						className={`btn ${suspended ? 'btn-primary' : 'btn-neutral'}`}
						disabled={isSettingActive}
					>
						{suspended ? 'Reactivate tenant' : 'Suspend tenant'}
					</button>
				</>
			}
		>
			{setActiveError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{setActiveError.message}
				</p>
			)}
			<dl className="grid grid-cols-3 gap-4 rounded-box bg-base-200 p-4">
				<div>
					<dt className="text-xs text-[var(--color-slate)]">Current access</dt>
					<dd className="mt-1 font-semibold">{suspended ? 'Suspended' : 'Active'}</dd>
				</div>
				<div>
					<dt className="text-xs text-[var(--color-slate)]">New access</dt>
					<dd className="mt-1 font-semibold">{suspended ? 'Active' : 'Suspended'}</dd>
				</div>
				<div>
					<dt className="text-xs text-[var(--color-slate)]">Records</dt>
					<dd className="mt-1 font-semibold">Retained</dd>
				</div>
			</dl>

			<div>
				<label htmlFor="status-reason" className="mb-2 block text-sm font-medium">
					{suspended ? 'Reason (optional)' : 'Reason for suspension *'}
				</label>
				<textarea
					id="status-reason"
					className="textarea w-full"
					rows={3}
					maxLength={500}
					required={!suspended}
					value={reason}
					onChange={(event) => setReason(event.target.value)}
					placeholder={suspended ? 'Access review completed' : 'Access review requested'}
				/>
				<p className="mt-1 text-xs text-[var(--color-slate)]">
					Recorded in the tenant activity log with your account.
				</p>
			</div>
		</Dialog>
	);
}
