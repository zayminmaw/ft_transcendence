import { useState } from 'react';
import { Dialog, useToast } from '@global-components';
import type { RevokeAdministratorValues, TenantAdministrator, TenantDetails } from '../api';
import { useMemberRoles } from '../hooks/useTenantAdministrators';
import { useTenantMutations } from '../hooks/useTenantMutations';

// Mount only while open, so each revoke starts with an empty reason. Revoking the last administrator who can still
// sign in suspends the tenant; otherwise the platform admin chooses whether they keep another role or leave.
export function RevokeAdministratorDialog({
	tenant,
	administrator,
	onClose,
}: {
	tenant: TenantDetails;
	administrator: TenantAdministrator;
	onClose: () => void;
}) {
	const { toast } = useToast();
	const { revokeAdministrator, isRevoking, revokeError } = useTenantMutations();
	// The same count as the API. After a conflict the details refresh, and this follows.
	const last = !tenant.administrators.some(
		(admin) => admin.id !== administrator.id && admin.accountActive,
	);
	const [outcome, setOutcome] = useState<'change_role' | 'remove'>('change_role');
	const [roleCode, setRoleCode] = useState('');
	const [reason, setReason] = useState('');
	const { roles, isRolesPending } = useMemberRoles(tenant.id, !last);
	const suspends = last && tenant.isActive;

	const values: RevokeAdministratorValues = last
		? { outcome: 'suspend_tenant', reason }
		: outcome === 'change_role'
			? { outcome, roleCode, reason }
			: { outcome, reason };

	return (
		<Dialog
			open
			onClose={onClose}
			title={`Revoke ${administrator.username}?`}
			description={`They lose tenant administrator permissions in ${tenant.name}. Their account and memberships in other companies are not affected.`}
			onSubmit={(event) => {
				event.preventDefault();
				revokeAdministrator(
					{ tenantId: tenant.id, userId: administrator.id, values },
					{
						onSuccess: ({ tenantSuspended }) => {
							onClose();
							toast({
								variant: 'success',
								title: tenantSuspended
									? 'Administrator revoked and tenant suspended'
									: 'Administrator access revoked',
							});
						},
					},
				);
			}}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={onClose}>
						Cancel
					</button>
					<button
						type="submit"
						className="btn btn-neutral"
						disabled={isRevoking || (values.outcome === 'change_role' && !roleCode)}
					>
						{suspends ? 'Revoke and suspend tenant' : 'Revoke access'}
					</button>
				</>
			}
		>
			{revokeError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{revokeError.message}
				</p>
			)}

			{last ? (
				<div role="status" className="rounded-box border border-base-300 p-4 text-sm">
					<p className="font-medium">
						{administrator.username} is the last administrator of {tenant.name}.
					</p>
					<p className="mt-1 text-[var(--color-slate)]">
						{suspends
							? 'Revoking them removes them from the company and suspends the tenant. It can be reactivated once a new administrator is assigned.'
							: 'Revoking them removes them from the company. The tenant is already suspended and can be reactivated once a new administrator is assigned.'}
					</p>
				</div>
			) : (
				<fieldset className="flex flex-col gap-3">
					<legend className="mb-2 text-sm font-medium">After revoking *</legend>
					<label className="flex items-start gap-3 rounded-box bg-base-200 p-4">
						<input
							type="radio"
							name="revoke-outcome"
							className="radio radio-sm mt-0.5"
							checked={outcome === 'change_role'}
							onChange={() => setOutcome('change_role')}
						/>
						<span className="flex min-w-0 flex-1 flex-col gap-2">
							<span>
								<span className="block font-medium">Keep in the company</span>
								<span className="text-sm text-[var(--color-slate)]">
									They keep working in {tenant.name} with another role.
								</span>
							</span>
							{outcome === 'change_role' && (
								<select
									aria-label="New role"
									className="select w-full"
									required
									value={roleCode}
									onChange={(event) => setRoleCode(event.target.value)}
								>
									<option value="" disabled>
										{isRolesPending ? 'Loading roles…' : 'Choose a role'}
									</option>
									{roles.map((role) => (
										<option key={role.code} value={role.code}>
											{role.name}
										</option>
									))}
								</select>
							)}
						</span>
					</label>
					<label className="flex items-start gap-3 rounded-box bg-base-200 p-4">
						<input
							type="radio"
							name="revoke-outcome"
							className="radio radio-sm mt-0.5"
							checked={outcome === 'remove'}
							onChange={() => setOutcome('remove')}
						/>
						<span>
							<span className="block font-medium">Remove from the company</span>
							<span className="text-sm text-[var(--color-slate)]">
								They can no longer open {tenant.name}.
							</span>
						</span>
					</label>
				</fieldset>
			)}

			<div>
				<label htmlFor="revoke-reason" className="mb-2 block text-sm font-medium">
					Reason *
				</label>
				<textarea
					id="revoke-reason"
					className="textarea w-full"
					rows={3}
					maxLength={500}
					required
					value={reason}
					onChange={(event) => setReason(event.target.value)}
				/>
				<p className="mt-1 text-xs text-[var(--color-slate)]">
					Recorded in the tenant activity log with your account
					{suspends ? ', and as the reason for the suspension' : ''}.
				</p>
			</div>
		</Dialog>
	);
}
