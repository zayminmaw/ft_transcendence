import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Select, useToast } from '@global-components';
import type { Driver } from '../api';
import { useLinkableAccounts } from '../hooks/useDriverAccounts';
import { useDriverMutations } from '../hooks/useDriverMutations';
import { driverErrorKey } from '../utils/errors';

// Links a company member with the driver role to this driver, or unlinks the current one (drivers.manage). The
// linked account is how a driver later sees only their own run. Mounted only while open.
export function LinkAccountDialog({ driver, onClose }: { driver: Driver; onClose: () => void }) {
	const { t } = useTranslation('drivers');
	const { toast } = useToast();
	const { accounts, isAccountsPending, isAccountsError } = useLinkableAccounts(!driver.account);
	const { linkDriverAccount, isLinking, linkError } = useDriverMutations();
	const [userId, setUserId] = useState('');
	const name = `${driver.firstName} ${driver.lastName}`;
	const linked = driver.account;

	return (
		<Dialog
			open
			onClose={onClose}
			title={linked ? t('account.unlinkTitle', { name }) : t('account.linkTitle', { name })}
			description={
				linked
					? t('account.unlinkDescription', { username: linked.username })
					: t('account.linkDescription')
			}
			onSubmit={(event) => {
				event.preventDefault();
				linkDriverAccount(
					{ driverId: driver.id, userId: linked ? null : userId },
					{
						onSuccess: () => {
							onClose();
							toast({
								variant: 'success',
								title: linked
									? t('account.unlinked')
									: t('account.linked', { name }),
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
					<button
						type="submit"
						className="btn btn-neutral"
						disabled={isLinking || (!linked && !userId)}
					>
						{linked ? t('account.unlink') : t('account.link')}
					</button>
				</>
			}
		>
			{!linked &&
				(accounts.length > 0 || isAccountsPending ? (
					<Select
						label={t('account.choose')}
						value={userId}
						onChange={(event) => setUserId(event.target.value)}
						disabled={isAccountsPending}
						options={[
							{ value: '', label: t('account.choosePlaceholder') },
							...accounts.map((account) => ({
								value: account.userId,
								label: account.username,
							})),
						]}
					/>
				) : (
					<p className="text-sm text-[var(--color-slate)]">
						{isAccountsError ? t('errors.unknown') : t('account.none')}
					</p>
				))}
			{linkError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(driverErrorKey(linkError))}
				</p>
			)}
		</Dialog>
	);
}
