import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, useToast } from '@global-components';
import type { RevokeAdministratorValues, TenantAdministrator, TenantDetails } from '../api';
import { useMemberRoles } from '../hooks/useTenantAdministrators';
import { useTenantMutations } from '../hooks/useTenantMutations';
import { platformErrorKey } from '../errors';

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
	const { t } = useTranslation('platform');
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
			title={t('revoke.title', { username: administrator.username })}
			description={t('revoke.description', { tenant: tenant.name })}
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
									? t('revoke.revokedAndSuspended')
									: t('revoke.revoked'),
							});
						},
					},
				);
			}}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={onClose}>
						{t('common.cancel')}
					</button>
					<button
						type="submit"
						className="btn btn-neutral"
						disabled={isRevoking || (values.outcome === 'change_role' && !roleCode)}
					>
						{suspends ? t('revoke.submitSuspend') : t('revoke.submit')}
					</button>
				</>
			}
		>
			{revokeError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(platformErrorKey(revokeError))}
				</p>
			)}

			{last ? (
				<div role="status" className="rounded-box border border-base-300 p-4 text-sm">
					<p className="font-medium">
						{t('revoke.last', {
							username: administrator.username,
							tenant: tenant.name,
						})}
					</p>
					<p className="mt-1 text-[var(--color-slate)]">
						{suspends ? t('revoke.lastSuspends') : t('revoke.lastSuspended')}
					</p>
				</div>
			) : (
				<fieldset className="flex flex-col gap-3">
					<legend className="mb-2 text-sm font-medium">{t('revoke.after')}</legend>
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
								<span className="block font-medium">{t('revoke.keep')}</span>
								<span className="text-sm text-[var(--color-slate)]">
									{t('revoke.keepText', { tenant: tenant.name })}
								</span>
							</span>
							{outcome === 'change_role' && (
								<select
									aria-label={t('revoke.newRole')}
									className="select w-full"
									required
									value={roleCode}
									onChange={(event) => setRoleCode(event.target.value)}
								>
									<option value="" disabled>
										{isRolesPending
											? t('revoke.loadingRoles')
											: t('revoke.chooseRole')}
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
							<span className="block font-medium">{t('revoke.remove')}</span>
							<span className="text-sm text-[var(--color-slate)]">
								{t('revoke.removeText', { tenant: tenant.name })}
							</span>
						</span>
					</label>
				</fieldset>
			)}

			<div>
				<label htmlFor="revoke-reason" className="mb-2 block text-sm font-medium">
					{t('revoke.reason')}
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
					{suspends ? t('revoke.recordedSuspends') : t('revoke.recorded')}
				</p>
			</div>
		</Dialog>
	);
}
