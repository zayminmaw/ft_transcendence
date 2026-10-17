import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, ModulePage, useToast } from '@global-components';
import { sampleTenant as tenant } from '../data/sampleTenants';

export function TenantDetailsPage() {
	const { toast } = useToast();
	const [dialogOpen, setDialogOpen] = useState(false);
	const suspended = tenant.status === 'suspended';

	const profile = [
		{ label: 'Organization name', value: tenant.organization },
		{ label: 'Slug', value: tenant.slug },
		{ label: 'Contact email', value: tenant.contactEmail },
		{ label: 'Phone', value: tenant.phone },
		{ label: 'Address', value: tenant.address },
		{ label: 'Created', value: tenant.createdAt },
	];

	return (
		<div className="flex flex-col gap-6">
			<ModulePage
				title={tenant.organization}
				description={`${tenant.slug} · Created ${tenant.createdAt} with its first administrator.`}
				actions={
					<button
						type="button"
						className="btn btn-primary w-full md:w-auto md:px-8"
						onClick={() => setDialogOpen(true)}
					>
						{suspended ? 'Reactivate tenant' : 'Suspend tenant'}
					</button>
				}
			/>

			{suspended && (
				<div role="status" className="rounded-box border border-base-300 p-4 text-sm">
					<p className="font-medium">Tenant access is suspended.</p>
					<p className="mt-1 text-[var(--color-slate)]">
						Members cannot open this company in the tenant portal or API. Organization,
						delivery and accounting records are retained.
					</p>
				</div>
			)}

			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<div className="flex flex-col gap-6">
					<section
						aria-labelledby="tenant-profile-title"
						className="rounded-box border border-base-300 p-4 md:p-8"
					>
						<h2 id="tenant-profile-title" className="text-lg font-semibold">
							Organization
						</h2>
						<dl className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
							{profile.map((item) => (
								<div key={item.label} className="min-w-0">
									<dt className="text-sm text-[var(--color-slate)]">
										{item.label}
									</dt>
									<dd className="mt-1 font-medium break-words">{item.value}</dd>
								</div>
							))}
						</dl>
					</section>

					<section
						aria-labelledby="tenant-admins-title"
						className="rounded-box border border-base-300 p-4 md:p-8"
					>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<h2 id="tenant-admins-title" className="text-lg font-semibold">
									Tenant administrators
								</h2>
								<p className="mt-1 text-sm text-[var(--color-slate)]">
									Company access only. Platform roles are managed separately.
								</p>
							</div>
							<Link
								to={`/platform/tenants/${tenant.id}/administrators`}
								className="btn btn-sm w-fit border-0 bg-base-200"
							>
								Manage administrators
							</Link>
						</div>
						<ul className="mt-6 flex flex-col gap-3">
							{tenant.administrators.map((admin) => (
								<li
									key={admin.username}
									className="flex flex-col gap-1 rounded-box bg-base-200 p-4 sm:flex-row sm:items-center sm:justify-between"
								>
									<div>
										<p className="font-medium">{admin.name}</p>
										<p className="text-sm text-[var(--color-slate)]">
											{admin.username}
										</p>
									</div>
									<p className="text-sm text-[var(--color-slate)]">
										{admin.origin}
									</p>
								</li>
							))}
						</ul>
					</section>
				</div>

				<aside className="flex flex-col gap-6">
					<section className="rounded-box bg-base-200 p-6 md:p-8">
						<h2 className="text-lg font-semibold">Memberships</h2>
						<dl className="mt-6 grid grid-cols-2 gap-4">
							<div>
								<dt className="text-sm text-[var(--color-slate)]">Members</dt>
								<dd className="mt-1 text-[2rem] font-medium leading-tight">
									{tenant.members}
								</dd>
							</div>
							<div>
								<dt className="text-sm text-[var(--color-slate)]">Active users</dt>
								<dd className="mt-1 text-[2rem] font-medium leading-tight">
									{tenant.activeMembers}
								</dd>
							</div>
						</dl>
					</section>
					<section className="rounded-box bg-neutral p-6 text-neutral-content md:p-8">
						<h2 className="workspace-title text-[2rem]">
							Suspend access. Retain history.
						</h2>
						<p className="mt-6 leading-relaxed">
							Suspension denies tenant portal and API access while preserving
							organization records, delivery history and accounting history.
						</p>
					</section>
				</aside>
			</div>

			<Dialog
				open={dialogOpen}
				onClose={() => setDialogOpen(false)}
				title={
					suspended
						? `Reactivate ${tenant.organization}?`
						: `Suspend ${tenant.organization}?`
				}
				description={
					suspended
						? 'Members with active memberships regain access to this company.'
						: 'All members lose access to this company. Their accounts and other company memberships are not affected.'
				}
				onSubmit={(e) => {
					e.preventDefault();
					setDialogOpen(false);
					toast({
						variant: 'success',
						title: suspended ? 'Tenant reactivated' : 'Tenant suspended',
					});
				}}
				actions={
					<>
						<button
							type="button"
							className="btn border-0 bg-base-200"
							onClick={() => setDialogOpen(false)}
						>
							Cancel
						</button>
						<button
							type="submit"
							className={`btn ${suspended ? 'btn-primary' : 'btn-neutral'}`}
						>
							{suspended ? 'Reactivate tenant' : 'Suspend tenant'}
						</button>
					</>
				}
			>
				<dl className="grid grid-cols-3 gap-4 rounded-box bg-base-200 p-4">
					<div>
						<dt className="text-xs text-[var(--color-slate)]">Current access</dt>
						<dd className="mt-1 font-semibold">{suspended ? 'Suspended' : 'Active'}</dd>
					</div>
					<div>
						<dt className="text-xs text-[var(--color-slate)]">New access</dt>
						<dd className="mt-1 font-semibold">{suspended ? 'Active' : 'Suspended'}</dd>
					</div>
					<div>
						<dt className="text-xs text-[var(--color-slate)]">Records</dt>
						<dd className="mt-1 font-semibold">Retained</dd>
					</div>
				</dl>

				<div>
					<label htmlFor="status-reason" className="mb-2 block text-sm font-medium">
						{suspended ? 'Reason (optional)' : 'Reason for suspension *'}
					</label>
					<textarea
						id="status-reason"
						className="textarea w-full"
						rows={3}
						required={!suspended}
						placeholder={
							suspended ? 'Access review completed' : 'Access review requested'
						}
					/>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						Recorded in the tenant activity log with your account.
					</p>
				</div>
			</Dialog>
		</div>
	);
}
