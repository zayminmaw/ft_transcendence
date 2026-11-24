import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ModulePage, Table } from '@global-components';
import type { TableColumn } from '@global-components';
import { formatDate } from '@utils/format';
import type { TenantAdministrator, TenantDetails } from '../api';
import { AssignAdministratorDialog } from '../components/AssignAdministratorDialog';
import { RevokeAdministratorDialog } from '../components/RevokeAdministratorDialog';
import { useTenantDetails } from '../hooks/useTenants';

export function TenantAdministratorsPage() {
	const { t } = useTranslation('platform');
	const { tenantId = '' } = useParams();
	const { tenant, isTenantPending, isTenantError } = useTenantDetails(tenantId);

	if (isTenantPending)
		return (
			<ModulePage title={t('administrators.title')} description={t('common.loadingTenant')} />
		);
	if (isTenantError || !tenant) {
		return (
			<div className="flex flex-col gap-6">
				<ModulePage
					title={t('common.loadFailedTitle')}
					description={t('common.loadFailed')}
				/>
				<Link to="/platform/tenants" className="btn w-fit border-0 bg-base-200 md:px-8">
					{t('common.backToTenants')}
				</Link>
			</div>
		);
	}
	return <TenantAdministratorsView tenant={tenant} />;
}

function TenantAdministratorsView({ tenant }: { tenant: TenantDetails }) {
	const { t, i18n } = useTranslation('platform');
	const [assignOpen, setAssignOpen] = useState(false);
	const [revoking, setRevoking] = useState<TenantAdministrator | null>(null);

	const columns: TableColumn<TenantAdministrator>[] = [
		{
			key: 'administrator',
			header: t('administrators.columns.administrator'),
			cell: (admin) => (
				<div>
					<p className="font-medium">
						<span dir="ltr">{admin.username}</span>
					</p>
					<p className="text-sm text-[var(--color-slate)]">
						<span dir="ltr">{admin.email}</span>
					</p>
				</div>
			),
		},
		{
			key: 'added',
			header: t('administrators.columns.added'),
			cell: (admin) => (
				<div>
					<p>{formatDate(admin.joinedAt, i18n.language)}</p>
					{!admin.accountActive && (
						<p className="text-sm text-[var(--color-slate)]">
							{t('common.accountDeactivated')}
						</p>
					)}
				</div>
			),
		},
		{
			key: 'action',
			header: t('administrators.columns.action'),
			cell: (admin) => (
				<button
					type="button"
					className="btn btn-sm border-0 bg-base-200"
					onClick={() => setRevoking(admin)}
				>
					{t('administrators.revoke')}
				</button>
			),
		},
	];

	return (
		<div className="flex flex-col gap-6">
			<ModulePage
				title={t('administrators.title')}
				description={t('administrators.description', { name: tenant.name })}
				actions={
					<button
						type="button"
						className="btn btn-primary w-full md:w-auto md:px-8"
						onClick={() => setAssignOpen(true)}
					>
						{t('administrators.assign')}
					</button>
				}
			/>

			<Table
				caption={t('administrators.caption', { name: tenant.name })}
				columns={columns}
				rows={tenant.administrators}
				getRowKey={(admin) => admin.id}
				emptyMessage={t('administrators.empty')}
			/>

			<Link
				to={`/platform/tenants/${tenant.id}`}
				className="btn w-fit border-0 bg-base-200 md:px-8"
			>
				{t('administrators.back')}
			</Link>

			{/* Mounted only while open, so each one starts empty. */}
			{assignOpen && (
				<AssignAdministratorDialog tenant={tenant} onClose={() => setAssignOpen(false)} />
			)}
			{revoking && (
				<RevokeAdministratorDialog
					tenant={tenant}
					administrator={revoking}
					onClose={() => setRevoking(null)}
				/>
			)}
		</div>
	);
}
