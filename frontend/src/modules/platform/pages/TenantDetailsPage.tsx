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
	const { t } = useTranslation('platform');
	const { tenantId = '' } = useParams();
	const { tenant, isTenantPending, isTenantError } = useTenantDetails(tenantId);

	if (isTenantPending)
		return <ModulePage title={t('details.title')} description={t('common.loadingTenant')} />;
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
	return <TenantDetailsView tenant={tenant} />;
}

function TenantDetailsView({ tenant }: { tenant: TenantDetails }) {
	const { t, i18n } = useTranslation('platform');
	const [statusOpen, setStatusOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const suspended = !tenant.isActive;
	const createdAt = formatDate(tenant.createdAt, i18n.language);

	return (
		<div className="flex flex-col gap-6">
			<ModulePage
				title={tenant.name}
				description={t('details.description', { slug: tenant.slug, date: createdAt })}
				actions={
					<button
						type="button"
						className="btn btn-primary w-full md:w-auto md:px-8"
						onClick={() => setStatusOpen(true)}
					>
						{suspended ? t('details.reactivate') : t('details.suspend')}
					</button>
				}
			/>

			{suspended && (
				<div role="status" className="rounded-box border border-base-300 p-4 text-sm">
					<p className="font-medium">{t('details.suspendedTitle')}</p>
					<p className="mt-1 text-[var(--color-slate)]">{t('details.suspendedText')}</p>
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
								{t('details.organization')}
							</h2>
							<button
								type="button"
								className="btn btn-sm w-fit border-0 bg-base-200"
								onClick={() => setEditOpen(true)}
							>
								{t('details.edit')}
							</button>
						</div>
						<dl className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
							<div className="min-w-0">
								<dt className="text-sm text-[var(--color-slate)]">
									{t('fields.organizationName')}
								</dt>
								<dd className="mt-1 font-medium break-words">{tenant.name}</dd>
							</div>
							<div className="min-w-0">
								<dt className="text-sm text-[var(--color-slate)]">
									{t('fields.slug')}
								</dt>
								<dd className="mt-1 font-medium break-words">
									<span dir="ltr">{tenant.slug}</span>
								</dd>
							</div>
							<div className="min-w-0">
								<dt className="text-sm text-[var(--color-slate)]">
									{t('fields.contactEmail')}
								</dt>
								<dd className="mt-1 font-medium break-words">
									<span dir="ltr">{tenant.contactEmail}</span>
								</dd>
							</div>
							<div className="min-w-0">
								<dt className="text-sm text-[var(--color-slate)]">
									{t('fields.phone')}
								</dt>
								<dd className="mt-1 font-medium break-words">
									<span dir="ltr">{tenant.contactPhone ?? '—'}</span>
								</dd>
							</div>
							<div className="min-w-0">
								<dt className="text-sm text-[var(--color-slate)]">
									{t('fields.address')}
								</dt>
								<dd className="mt-1 font-medium break-words">
									{tenant.address ?? '—'}
								</dd>
							</div>
							<div className="min-w-0">
								<dt className="text-sm text-[var(--color-slate)]">
									{t('fields.created')}
								</dt>
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
									{t('details.administrators')}
								</h2>
								<p className="mt-1 text-sm text-[var(--color-slate)]">
									{t('details.administratorsNote')}
								</p>
							</div>
							<Link
								to={`/platform/tenants/${tenant.id}/administrators`}
								className="btn btn-sm w-fit border-0 bg-base-200"
							>
								{t('details.manageAdministrators')}
							</Link>
						</div>
						{tenant.administrators.length === 0 ? (
							<p className="mt-6 text-sm text-[var(--color-slate)]">
								{t('details.noAdministrator')}
							</p>
						) : (
							<ul className="mt-6 flex flex-col gap-3">
								{tenant.administrators.map((admin) => (
									<li
										key={admin.id}
										className="flex flex-col gap-1 rounded-box bg-base-200 p-4 sm:flex-row sm:items-center sm:justify-between"
									>
										<div className="min-w-0">
											<p className="font-medium">
												<span dir="ltr">{admin.username}</span>
											</p>
											<p className="text-sm break-words text-[var(--color-slate)]">
												<span dir="ltr">{admin.email}</span>
											</p>
										</div>
										<p className="text-sm text-[var(--color-slate)]">
											{admin.accountActive
												? t('details.since', {
														date: formatDate(
															admin.joinedAt,
															i18n.language,
														),
													})
												: t('common.accountDeactivated')}
										</p>
									</li>
								))}
							</ul>
						)}
					</section>
				</div>

				<aside className="flex flex-col gap-6">
					<section className="rounded-box bg-base-200 p-6 md:p-8">
						<h2 className="text-lg font-semibold">{t('details.memberships')}</h2>
						<dl className="mt-6 grid grid-cols-2 gap-4">
							<div>
								<dt className="text-sm text-[var(--color-slate)]">
									{t('details.members')}
								</dt>
								<dd className="mt-1 text-[2rem] font-medium leading-tight">
									{formatNumber(tenant.membership.members, i18n.language)}
								</dd>
							</div>
							<div>
								<dt className="text-sm text-[var(--color-slate)]">
									{t('details.activeUsers')}
								</dt>
								<dd className="mt-1 text-[2rem] font-medium leading-tight">
									{formatNumber(tenant.membership.activeMembers, i18n.language)}
								</dd>
							</div>
						</dl>
					</section>
					<TipCard title={t('details.tipTitle')} description={t('details.tipText')} />
				</aside>
			</div>

			<StatusDialog tenant={tenant} open={statusOpen} onClose={() => setStatusOpen(false)} />
			{/* Mounted only while open, so the form starts from the saved details each time. */}
			{editOpen && <EditDialog tenant={tenant} onClose={() => setEditOpen(false)} />}
		</div>
	);
}
