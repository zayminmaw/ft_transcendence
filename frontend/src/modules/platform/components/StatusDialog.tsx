import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
	const { t } = useTranslation('platform');
	const { toast } = useToast();
	const { setTenantActive, isSettingActive, setActiveError, resetSetActive } =
		useTenantMutations();
	const [reason, setReason] = useState('');
	const suspended = !tenant.isActive;
	// The API refuses to reactivate a company with no administrator who can sign in.
	const needsAdministrator =
		suspended && !tenant.administrators.some((admin) => admin.accountActive);
	const close = () => {
		setReason('');
		resetSetActive();
		onClose();
	};

	return (
		<Dialog
			open={open}
			onClose={close}
			title={t(suspended ? 'status.reactivateTitle' : 'status.suspendTitle', {
				name: tenant.name,
			})}
			description={suspended ? t('status.reactivateText') : t('status.suspendText')}
			onSubmit={(event) => {
				event.preventDefault();
				setTenantActive(
					{ tenantId: tenant.id, active: suspended, reason },
					{
						onSuccess: () => {
							close();
							toast({
								variant: 'success',
								title: suspended
									? t('status.reactivated')
									: t('status.suspendedToast'),
							});
						},
					},
				);
			}}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={close}>
						{t('common.cancel')}
					</button>
					<button
						type="submit"
						className={`btn ${suspended ? 'btn-primary' : 'btn-neutral'}`}
						disabled={isSettingActive || needsAdministrator}
					>
						{suspended ? t('details.reactivate') : t('details.suspend')}
					</button>
				</>
			}
		>
			{needsAdministrator && (
				<p role="status" className="alert alert-warning alert-soft text-sm">
					{t('status.needsAdministrator', { name: tenant.name })}
				</p>
			)}
			{setActiveError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{setActiveError.message}
				</p>
			)}
			<dl className="grid grid-cols-3 gap-4 rounded-box bg-base-200 p-4">
				<div>
					<dt className="text-xs text-[var(--color-slate)]">
						{t('status.currentAccess')}
					</dt>
					<dd className="mt-1 font-semibold">
						{suspended ? t('common.suspended') : t('common.active')}
					</dd>
				</div>
				<div>
					<dt className="text-xs text-[var(--color-slate)]">{t('status.newAccess')}</dt>
					<dd className="mt-1 font-semibold">
						{suspended ? t('common.active') : t('common.suspended')}
					</dd>
				</div>
				<div>
					<dt className="text-xs text-[var(--color-slate)]">{t('status.records')}</dt>
					<dd className="mt-1 font-semibold">{t('status.retained')}</dd>
				</div>
			</dl>

			<div>
				<label htmlFor="status-reason" className="mb-2 block text-sm font-medium">
					{suspended ? t('status.reasonOptional') : t('status.reasonRequired')}
				</label>
				<textarea
					id="status-reason"
					className="textarea w-full"
					rows={3}
					maxLength={500}
					required={!suspended}
					value={reason}
					onChange={(event) => setReason(event.target.value)}
					placeholder={
						suspended
							? t('status.reactivatePlaceholder')
							: t('status.suspendPlaceholder')
					}
				/>
				<p className="mt-1 text-xs text-[var(--color-slate)]">{t('status.recorded')}</p>
			</div>
		</Dialog>
	);
}
