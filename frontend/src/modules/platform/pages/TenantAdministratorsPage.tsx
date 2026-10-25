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
	const { tenantId = '' } = useParams();
	const { tenant, isTenantPending, isTenantError } = useTenantDetails(tenantId);

	if (isTenantPending)
		return <ModulePage title="Tenant administrators" description="Loading tenant…" />;
	if (isTenantError || !tenant) {
		return (
			<div className="flex flex-col gap-6">
				<ModulePage
					title="Something went wrong"
					description="This tenant couldn't be loaded. Go back to the tenant list and try again."
				/>
				<Link to="/platform/tenants" className="btn w-fit border-0 bg-base-200 md:px-8">
					Back to tenants
				</Link>
			</div>
		);
	}
	return <TenantAdministratorsView tenant={tenant} />;
}

function TenantAdministratorsView({ tenant }: { tenant: TenantDetails }) {
	const { i18n } = useTranslation();
	const [assignOpen, setAssignOpen] = useState(false);
	const [revoking, setRevoking] = useState<TenantAdministrator | null>(null);

	const columns: TableColumn<TenantAdministrator>[] = [
		{
			key: 'administrator',
			header: 'Administrator',
			cell: (admin) => (
				<div>
					<p className="font-medium">{admin.username}</p>
					<p className="text-sm text-[var(--color-slate)]">{admin.email}</p>
				</div>
			),
		},
		{
			key: 'added',
			header: 'Added',
			cell: (admin) => (
				<div>
					<p>{formatDate(admin.joinedAt, i18n.language)}</p>
					{!admin.accountActive && (
						<p className="text-sm text-[var(--color-slate)]">Account deactivated</p>
					)}
				</div>
			),
		},
		{
			key: 'action',
			header: 'Action',
			cell: (admin) => (
				<button
					type="button"
					className="btn btn-sm border-0 bg-base-200"
					onClick={() => setRevoking(admin)}
				>
					Revoke
				</button>
			),
		},
	];

	return (
		<div className="flex flex-col gap-6">
			<ModulePage
				title="Tenant administrators"
				description={`${tenant.name} · These memberships grant company access only. Platform roles are managed separately.`}
				actions={
					<button
						type="button"
						className="btn btn-primary w-full md:w-auto md:px-8"
						onClick={() => setAssignOpen(true)}
					>
						Assign administrator
					</button>
				}
			/>

			<Table
				caption={`${tenant.name} administrators`}
				columns={columns}
				rows={tenant.administrators}
				getRowKey={(admin) => admin.id}
				emptyMessage="No active tenant administrator. Assign one before reactivating the tenant."
			/>

			<Link
				to={`/platform/tenants/${tenant.id}`}
				className="btn w-fit border-0 bg-base-200 md:px-8"
			>
				Back to tenant
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
