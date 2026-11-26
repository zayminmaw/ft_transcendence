import { useState } from 'react';
import { createInviteUrl } from '@modules/auth/invite-link';
import { useTranslation } from 'react-i18next';
import { Button, Dialog } from '@global-components';
import { useRoleName } from '@modules/auth';
import { formatDate } from '@utils/format';
import type { CreateInviteResponse } from '../api';

// Shows the one-time invite link right after creation so the admin can copy and share it.
export function InviteCreatedDialog({
	created,
	company,
	onClose,
}: {
	created: CreateInviteResponse;
	company: string;
	onClose: () => void;
}) {
	const { t, i18n } = useTranslation('rbac');
	const roleName = useRoleName();
	const [copied, setCopied] = useState(false);
	const inviteUrl = createInviteUrl(window.location.origin, created.token);

	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(inviteUrl);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	};

	return (
		<Dialog
			open
			onClose={onClose}
			title={t('invites.createdTitle')}
			description={t('invites.createdDescription', {
				role: roleName(created.invite.role),
				company,
			})}
			actions={<Button onClick={onClose}>{t('manage.close')}</Button>}
		>
			<div className="flex flex-col gap-3">
				<p className="text-xs text-[var(--color-slate)]">{t('invites.linkLabel')}</p>
				<div className="flex flex-wrap items-center gap-2 rounded-box border border-base-300 bg-base-200 p-3">
					<code
						dir="ltr"
						className="min-w-0 flex-1 break-all font-mono text-xs select-all"
					>
						{inviteUrl}
					</code>
					<button
						type="button"
						className="btn btn-sm bg-base-100"
						onClick={() => void copyLink()}
					>
						{copied ? t('manage.copied') : t('invites.copyLink')}
					</button>
				</div>
				{created.invite.email && (
					<p className="text-xs text-[var(--color-slate)]">
						{t('invites.lockedToEmail', { email: created.invite.email })}
					</p>
				)}
				<p className="text-xs text-[var(--color-slate)]">
					{t('invites.oneTimeNote', {
						date: formatDate(created.invite.expiresAt, i18n.language, {
							dateStyle: 'medium',
						}),
					})}
				</p>
			</div>
		</Dialog>
	);
}
