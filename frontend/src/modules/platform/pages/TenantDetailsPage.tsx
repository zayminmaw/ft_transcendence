import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ModulePage, TipCard } from '@global-components';
import { formatDate, formatNumber } from '@utils/format';
import type { TenantDetails } from '../api';
import { EditDialog } from '../components/EditDialog';
import { StatusDialog } from '../components/StatusDialog';
import { useTenantDetails } from '../hooks/useTenants';

export function TenantDetailsPage() {
	const { tenantId = '' } = useParams();
	const { tenant, isTenantPending, isTenantError } = useTenantDetails(tenantId);

	if (isTenantPending) return <ModulePage title="Tenant" description="Loading tenant…" />;
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
	return <TenantDetailsView tenant={tenant} />;
}

function TenantDetailsView({ tenant }: { tenant: TenantDetails }) {
	const { i18n } = useTranslation();
	const [statusOpen, setStatusOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const suspended = !tenant.isActive;
	const createdAt = formatDate(tenant.createdAt, i18n.language);

	return (
		<div className="flex flex-col gap-6">
			<ModulePage
				title={tenant.name}
				description={`${tenant.slug} · Created ${createdAt}`}
				actions={
					<button
						type="button"
						className="btn btn-primary w-full md:w-auto md:px-8"
						onClick={() => setStatusOpen(true)}
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
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<h2 id="tenant-profile-title" className="text-lg font-semibold">
								Organization
							</h2>
							<button
								type="button"
								className="btn btn-sm w-fit border-0 bg-base-200"
								onClick={() => setEditOpen(true)}
							>
								Edit details
							</button>
						</div>
						<dl className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
							<div className="min-w-0">
								<dt className="text-sm text-[var(--color-slate)]">
									Organization name
								</dt>
								<dd className="mt-1 font-medium break-words">{tenant.name}</dd>
							</div>
							<div className="min-w-0">
								<dt className="text-sm text-[var(--color-slate)]">Slug</dt>
								<dd className="mt-1 font-medium break-words">{tenant.slug}</dd>
							</div>
							<div className="min-w-0">
								<dt className="text-sm text-[var(--color-slate)]">Contact email</dt>
								<dd className="mt-1 font-medium break-words">
									{tenant.contactEmail}
								</dd>
							</div>
							<div className="min-w-0">
								<dt className="text-sm text-[var(--color-slate)]">Phone</dt>
								<dd className="mt-1 font-medium break-words">
									{tenant.contactPhone ?? '—'}
								</dd>
							</div>
							<div className="min-w-0">
								<dt className="text-sm text-[var(--color-slate)]">Address</dt>
								<dd className="mt-1 font-medium break-words">
									{tenant.address ?? '—'}
								</dd>
							</div>
							<div className="min-w-0">
								<dt className="text-sm text-[var(--color-slate)]">Created</dt>
								<dd className="mt-1 font-medium break-words">{createdAt}</dd>
							</div>
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
						{tenant.administrators.length === 0 ? (
							<p className="mt-6 text-sm text-[var(--color-slate)]">
								No active tenant administrator.
							</p>
						) : (
							<ul className="mt-6 flex flex-col gap-3">
								{tenant.administrators.map((admin) => (
									<li
										key={admin.id}
										className="flex flex-col gap-1 rounded-box bg-base-200 p-4 sm:flex-row sm:items-center sm:justify-between"
									>
										<div className="min-w-0">
											<p className="font-medium">{admin.username}</p>
											<p className="text-sm break-words text-[var(--color-slate)]">
												{admin.email}
											</p>
										</div>
										<p className="text-sm text-[var(--color-slate)]">
											{admin.accountActive
												? `Since ${formatDate(admin.joinedAt, i18n.language)}`
												: 'Account deactivated'}
										</p>
									</li>
								))}
							</ul>
						)}
					</section>
				</div>

				<aside className="flex flex-col gap-6">
					<section className="rounded-box bg-base-200 p-6 md:p-8">
						<h2 className="text-lg font-semibold">Memberships</h2>
						<dl className="mt-6 grid grid-cols-2 gap-4">
							<div>
								<dt className="text-sm text-[var(--color-slate)]">Members</dt>
								<dd className="mt-1 text-[2rem] font-medium leading-tight">
									{formatNumber(tenant.membership.members, i18n.language)}
								</dd>
							</div>
							<div>
								<dt className="text-sm text-[var(--color-slate)]">Active users</dt>
								<dd className="mt-1 text-[2rem] font-medium leading-tight">
									{formatNumber(tenant.membership.activeMembers, i18n.language)}
								</dd>
							</div>
						</dl>
					</section>
					<TipCard
						title="Suspend access. Retain history."
						description="Suspension denies tenant portal and API access while preserving organization records, delivery history and accounting history."
					/>
				</aside>
			</div>

			<StatusDialog tenant={tenant} open={statusOpen} onClose={() => setStatusOpen(false)} />
			{/* Mounted only while open, so the form starts from the saved details each time. */}
			{editOpen && <EditDialog tenant={tenant} onClose={() => setEditOpen(false)} />}
		</div>
	);
}
