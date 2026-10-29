import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Select, useToast } from '@global-components';
import type { DispatchStatus, Driver } from '../api';
import { MANUAL_DISPATCH_STATUSES } from '../constants';
import { useDriverMutations } from '../hooks/useDriverMutations';
import { driverErrorKey } from '../utils/errors';

// Sets a driver available, off duty or suspended (drivers.manage). Dispatch sets the on-run statuses. Mounted
// only while open, so every opening starts from the driver's current status.
export function DutyStatusDialog({ driver, onClose }: { driver: Driver; onClose: () => void }) {
	const { t } = useTranslation('drivers');
	const { toast } = useToast();
	const { setDriverDispatchStatus, isSettingStatus, setStatusError } = useDriverMutations();
	const [status, setStatus] = useState<DispatchStatus>(
		MANUAL_DISPATCH_STATUSES.includes(driver.dispatchStatus)
			? driver.dispatchStatus
			: 'available',
	);
	const name = `${driver.firstName} ${driver.lastName}`;

	return (
		<Dialog
			open
			onClose={onClose}
			title={t('duty.title', { name })}
			description={t('duty.description', {
				status: t(`dispatchStatus.${driver.dispatchStatus}`),
			})}
			onSubmit={(event) => {
				event.preventDefault();
				setDriverDispatchStatus(
					{ driverId: driver.id, status },
					{
						onSuccess: () => {
							onClose();
							toast({
								variant: 'success',
								title: t('duty.changed', {
									name,
									status: t(`dispatchStatus.${status}`),
								}),
							});
						},
					},
				);
			}}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={onClose}>
						{t('form.cancel')}
					</button>
					<button type="submit" className="btn btn-neutral" disabled={isSettingStatus}>
						{t('duty.submit')}
					</button>
				</>
			}
		>
			<Select
				label={t('duty.newStatus')}
				value={status}
				onChange={(event) => setStatus(event.target.value as DispatchStatus)}
				options={MANUAL_DISPATCH_STATUSES.map((value) => ({
					value,
					label: t(`dispatchStatus.${value}`),
				}))}
			/>
			<p className="-mt-4 text-xs text-[var(--color-slate)]">{t('duty.note')}</p>
			{setStatusError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(driverErrorKey(setStatusError))}
				</p>
			)}
		</Dialog>
	);
}
