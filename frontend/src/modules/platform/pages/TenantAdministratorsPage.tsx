import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Dialog, Input, ModulePage, Table, useToast } from '@global-components';
import type { TableColumn } from '@global-components';
import { formatDate } from '@utils/format';
import type { TenantAdministrator, TenantDetails } from '../api';
import { useTenantDetails } from '../hooks/useTenants';

// Sample members for the "Existing member" choice until the tenant members endpoint exists.
const sampleMembers = [
	{ username: 'rami.saleh', role: 'Dispatcher' },
	{ username: 'huda.amin', role: 'Finance' },
	{ username: 'samer.kassab', role: 'Hub operator' },
];

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

// Assigning and revoking are not wired to the API yet: their dialogs only show a toast.
function TenantAdministratorsView({ tenant }: { tenant: TenantDetails }) {
	const { i18n } = useTranslation();
	const { toast } = useToast();
	const [assignOpen, setAssignOpen] = useState(false);
	const [assignMode, setAssignMode] = useState<'new' | 'existing'>('new');
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
			/>

			<Link
				to={`/platform/tenants/${tenant.id}`}
				className="btn w-fit border-0 bg-base-200 md:px-8"
			>
				Back to tenant
			</Link>

			<Dialog
				open={assignOpen}
				onClose={() => setAssignOpen(false)}
				title="Assign administrator"
				description={`The administrator gets tenant permissions in ${tenant.name} only. No platform access is granted.`}
				onSubmit={(e) => {
					e.preventDefault();
					setAssignOpen(false);
					toast({ variant: 'success', title: 'Administrator assigned' });
				}}
				actions={
					<>
						<button
							type="button"
							className="btn border-0 bg-base-200"
							onClick={() => setAssignOpen(false)}
						>
							Cancel
						</button>
						<button type="submit" className="btn btn-primary">
							Assign administrator
						</button>
					</>
				}
			>
				<div role="tablist" aria-label="Administrator source" className="tabs tabs-box">
					<button
						type="button"
						role="tab"
						aria-selected={assignMode === 'new'}
						className={`tab flex-1 ${assignMode === 'new' ? 'tab-active' : ''}`}
						onClick={() => setAssignMode('new')}
					>
						New account
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={assignMode === 'existing'}
						className={`tab flex-1 ${assignMode === 'existing' ? 'tab-active' : ''}`}
						onClick={() => setAssignMode('existing')}
					>
						Existing member
					</button>
				</div>

				{assignMode === 'new' ? (
					<div className="flex flex-col gap-4">
						<Input label="Username" required autoComplete="off" />
						<Input label="Login email" type="email" required autoComplete="off" />
						<Input
							label="Initial password"
							type="password"
							required
							autoComplete="new-password"
						/>
						<p className="text-xs text-[var(--color-slate)]">
							Hand over credentials securely. Passwords are hidden from confirmation
							and audit records.
						</p>
					</div>
				) : (
					<div>
						<label htmlFor="assign-member" className="mb-2 block text-sm font-medium">
							Member *
						</label>
						<select
							id="assign-member"
							className="select w-full"
							required
							defaultValue=""
						>
							<option value="" disabled>
								Choose a {tenant.name} member
							</option>
							{sampleMembers.map((member) => (
								<option key={member.username} value={member.username}>
									{member.username} · {member.role}
								</option>
							))}
						</select>
						<p className="mt-1 text-xs text-[var(--color-slate)]">
							Their current company role is replaced by Tenant administrator.
						</p>
					</div>
				)}
			</Dialog>

			<Dialog
				open={revoking !== null}
				onClose={() => setRevoking(null)}
				title={`Revoke ${revoking?.username ?? 'administrator'}?`}
				description={`They lose tenant administrator permissions in ${tenant.name}. Their account and memberships in other companies are not affected.`}
				onSubmit={(e) => {
					e.preventDefault();
					setRevoking(null);
					toast({ variant: 'success', title: 'Administrator access revoked' });
				}}
				actions={
					<>
						<button
							type="button"
							className="btn border-0 bg-base-200"
							onClick={() => setRevoking(null)}
						>
							Cancel
						</button>
						<button type="submit" className="btn btn-neutral">
							Revoke access
						</button>
					</>
				}
			>
				<div>
					<label htmlFor="revoke-reason" className="mb-2 block text-sm font-medium">
						Reason *
					</label>
					<textarea id="revoke-reason" className="textarea w-full" rows={3} required />
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						Recorded in the tenant activity log with your account.
					</p>
				</div>
			</Dialog>
		</div>
	);
}
