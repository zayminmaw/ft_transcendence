import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Table, useToast } from '@global-components';
import type { TableColumn } from '@global-components';
import { shownName, useRoleName } from '@modules/auth';
import { formatDate } from '@utils/format';
import type { InviteStatus, MemberInvite } from '../api';
import { memberErrorKey } from '../errors';
import { useInvites, useRevokeInvite } from '../hooks';

const STATUS_BADGE: Record<InviteStatus, string> = {
	pending: 'badge-info',
	used: 'badge-success',
	expired: 'badge-ghost',
	revoked: 'badge-warning',
};

export function InvitesOverview() {
	const { t, i18n } = useTranslation('rbac');
	const roleName = useRoleName();
	const { toast } = useToast();
	const invites = useInvites();
	const revoke = useRevokeInvite();
	const [revoking, setRevoking] = useState<MemberInvite | null>(null);

	if (invites.isPending) {
		return <span className="loading loading-spinner" aria-label={t('invites.loading')} />;
	}
	if (invites.isError) {
		return (
			<div role="alert" className="alert alert-error alert-soft flex flex-wrap text-sm">
				{t('invites.loadFailed')}
				<Button className="btn-sm" onClick={() => void invites.refetch()}>
					{t('page.retry')}
				</Button>
			</div>
		);
	}

	const columns: TableColumn<MemberInvite>[] = [
		{
			key: 'recipient',
			header: t('invites.columns.recipient'),
			cell: (invite) =>
				invite.email ? (
					<span dir="ltr" className="font-medium">
						{invite.email}
					</span>
				) : (
					<span className="text-[var(--color-slate)]">{t('invites.anyEmail')}</span>
				),
		},
		{
			key: 'role',
			header: t('table.role'),
			cell: (invite) => roleName(invite.role),
		},
		{
			key: 'status',
			header: t('table.status'),
			cell: (invite) => (
				<span className={`badge badge-soft badge-sm ${STATUS_BADGE[invite.status]}`}>
					{t(`invites.status.${invite.status}`)}
				</span>
			),
		},
		{
			key: 'expiresAt',
			header: t('invites.columns.expires'),
			cell: (invite) =>
				formatDate(new Date(invite.expiresAt), i18n.language, { dateStyle: 'medium' }),
		},
		{
			key: 'usedBy',
			header: t('invites.columns.usedBy'),
			cell: (invite) =>
				invite.usedBy ? (
					<span>{shownName(invite.usedBy)}</span>
				) : (
					<span className="text-[var(--color-slate)]">—</span>
				),
		},
		{
			key: 'action',
			header: t('table.action'),
			cell: (invite) =>
				invite.status === 'pending' ? (
					<button
						type="button"
						className="btn btn-ghost btn-sm text-error"
						onClick={() => setRevoking(invite)}
					>
						{t('invites.revoke')}
					</button>
				) : (
					<span className="text-[var(--color-slate)]">—</span>
				),
		},
	];

	const confirmRevoke = () => {
		if (!revoking) return;
		revoke.mutate(revoking.id, {
			onSuccess: () => {
				toast({ variant: 'success', title: t('invites.revokedToast') });
				setRevoking(null);
			},
			onError: (error) => {
				toast({ variant: 'error', title: t(memberErrorKey(error)) });
				setRevoking(null);
			},
		});
	};

	return (
		<>
			<Table
				caption={t('invites.title')}
				columns={columns}
				rows={invites.data}
				getRowKey={(invite) => invite.id}
				emptyMessage={t('invites.empty')}
			/>
			{revoking && (
				<Dialog
					open
					onClose={() => setRevoking(null)}
					title={t('invites.revokeTitle')}
					description={t('invites.revokeConfirm', {
						role: roleName(revoking.role),
					})}
					actions={
						<>
							<button
								type="button"
								className="btn btn-ghost bg-base-200"
								disabled={revoke.isPending}
								onClick={() => setRevoking(null)}
							>
								{t('manage.cancel')}
							</button>
							<button
								type="button"
								className="btn btn-error"
								disabled={revoke.isPending}
								onClick={confirmRevoke}
							>
								{revoke.isPending ? t('invites.revoking') : t('invites.revoke')}
							</button>
						</>
					}
				>
					{revoking.email && (
						<p className="text-sm">
							<span dir="ltr">{revoking.email}</span>
						</p>
					)}
				</Dialog>
			)}
		</>
	);
}
