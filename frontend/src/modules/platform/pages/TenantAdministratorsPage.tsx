import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, Input, ModulePage, Table, useToast } from '@global-components';
import type { TableColumn } from '@global-components';
import { sampleMembers, sampleTenant as tenant } from '../data/sampleTenants';

type Administrator = (typeof tenant.administrators)[number];

export function TenantAdministratorsPage() {
	const { toast } = useToast();
	const [assignOpen, setAssignOpen] = useState(false);
	const [assignMode, setAssignMode] = useState<'new' | 'existing'>('new');
	const [revoking, setRevoking] = useState<Administrator | null>(null);

	const columns: TableColumn<Administrator>[] = [
		{
			key: 'administrator',
			header: 'Administrator',
			cell: (admin) => (
				<div>
					<p className="font-medium">{admin.name}</p>
					<p className="text-sm text-[var(--color-slate)]">
						{admin.username} · {admin.email}
					</p>
				</div>
			),
		},
		{
			key: 'added',
			header: 'Added',
			cell: (admin) => (
				<div>
					<p>{admin.addedAt}</p>
					<p className="text-sm text-[var(--color-slate)]">{admin.origin}</p>
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
				description={`${tenant.organization} · These memberships grant company access only. Platform roles are managed separately.`}
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
				caption={`${tenant.organization} administrators`}
				columns={columns}
				rows={tenant.administrators}
				getRowKey={(admin) => admin.username}
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
				description={`The administrator gets tenant permissions in ${tenant.organization} only. No platform access is granted.`}
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
								Choose a {tenant.organization} member
							</option>
							{sampleMembers.map((member) => (
								<option key={member.username} value={member.username}>
									{member.name} · {member.role}
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
				title={`Revoke ${revoking?.name ?? 'administrator'}?`}
				description={`They lose tenant administrator permissions in ${tenant.organization}. Their account and memberships in other companies are not affected.`}
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
