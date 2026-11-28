import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Avatar, Button, DetailItem, ImageViewer, ModulePage } from '@global-components';
import { formatDate } from '@utils/format';
import { AccountActivitySection } from '../components/AccountActivitySection';
import { AvatarForm } from '../components/AvatarForm';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { DisplayNameForm } from '../components/DisplayNameForm';
import { shownName, useMe, useRoleName } from '../hooks';

// Skeleton mirroring the 2-column workspace profile layout while /me loads.
function ProfileSkeleton() {
	return (
		<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div className="flex flex-col gap-6">
				<div className="rounded-box border border-base-300 p-6 md:p-8">
					<div className="flex items-center gap-4">
						<div className="skeleton size-20 shrink-0 rounded-full" />
						<div className="flex flex-1 flex-col gap-2">
							<div className="skeleton h-6 w-48" />
							<div className="skeleton h-4 w-32" />
						</div>
					</div>
					<div className="mt-6 border-t border-base-300 pt-6">
						<div className="skeleton h-11 w-full" />
						<div className="skeleton mt-4 h-10 w-32" />
					</div>
				</div>
				<div className="rounded-box border border-base-300 p-6 md:p-8">
					<div className="skeleton h-6 w-36" />
					<div className="mt-6 flex flex-col gap-4">
						<div className="skeleton h-11 w-full" />
						<div className="skeleton h-11 w-full" />
						<div className="skeleton h-11 w-full" />
					</div>
				</div>
			</div>
			<div className="flex flex-col gap-6">
				<div className="rounded-box bg-base-200 p-6">
					<div className="skeleton h-5 w-32" />
					<div className="mt-4 flex flex-col gap-4">
						<div className="skeleton h-10 w-full" />
						<div className="skeleton h-10 w-full" />
						<div className="skeleton h-10 w-40" />
					</div>
				</div>
			</div>
			<div className="rounded-box border border-base-300 p-6 md:p-8 lg:col-span-2">
				<div className="skeleton h-6 w-44" />
				<div className="mt-4 flex flex-col gap-3">
					<div className="skeleton h-10 w-full" />
					<div className="skeleton h-12 w-full" />
					<div className="skeleton h-12 w-full" />
				</div>
			</div>
		</div>
	);
}

// Account profile rendered inside the standard DashboardLayout (/app/:companySlug/profile, /platform/profile, or
// /profile). Primary editing forms sit on paper-white bordered cards on the left; read-only account metadata and
// workspace access sit in cloud-surface summary panels on the right.
export function ProfilePage() {
	const { t, i18n } = useTranslation('auth');
	const me = useMe();
	const roleName = useRoleName();
	const { companySlug } = useParams();
	const { pathname } = useLocation();
	const [passwordChanged, setPasswordChanged] = useState(false);

	const header = <ModulePage title={t('profile.title')} description={t('profile.description')} />;

	if (me.isPending) {
		return (
			<div className="flex flex-col gap-6" aria-busy="true">
				{header}
				<ProfileSkeleton />
			</div>
		);
	}

	if (me.isError) {
		return (
			<div className="flex flex-col gap-6">
				{header}
				<div
					role="alert"
					className="rounded-box border border-base-300 bg-base-200 px-6 py-12 text-center"
				>
					<p className="font-medium">{t('picker.loadFailed')}</p>
					<Button
						type="button"
						className="mt-4"
						onClick={() => void me.refetch()}
						disabled={me.isFetching}
					>
						{t('picker.retry')}
					</Button>
				</div>
			</div>
		);
	}

	const { user, workspaces, platformAccess } = me.data;
	const name = shownName(user);
	const inPlatform = pathname.startsWith('/platform');

	return (
		<div className="flex flex-col gap-6">
			{header}
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<div className="flex flex-col gap-6">
					<section className="rounded-box border border-base-300 p-6 md:p-8">
						<div className="flex flex-col gap-5 sm:flex-row sm:items-center">
							{user.avatarUrl ? (
								<ImageViewer src={user.avatarUrl} label={t('profile.pictureView')}>
									<Avatar
										name={name}
										seed={user.username}
										src={user.avatarUrl}
										size="lg"
									/>
								</ImageViewer>
							) : (
								<Avatar name={name} seed={user.username} size="lg" />
							)}
							<div className="flex min-w-0 flex-1 flex-col gap-3">
								<div className="min-w-0">
									<h2
										id="profile-about"
										className="truncate text-lg font-semibold"
									>
										<bdi>{name}</bdi>
									</h2>
									{user.displayName && (
										<p className="mt-0.5 truncate text-sm text-[var(--color-slate)]">
											<span dir="ltr">{user.username}</span>
										</p>
									)}
								</div>
								<AvatarForm hasPicture={user.avatarUrl !== null} />
							</div>
						</div>
						<div className="mt-6 border-t border-base-300 pt-6">
							<DisplayNameForm
								current={user.displayName}
								labelledBy="profile-about"
							/>
						</div>
					</section>

					<section className="rounded-box border border-base-300 p-6 md:p-8">
						<div>
							<h2 id="profile-password" className="text-lg font-semibold">
								{t('profile.password')}
							</h2>
							<p className="mt-1 text-sm text-[var(--color-slate)]">
								{t('profile.passwordIntro')}
							</p>
						</div>
						{passwordChanged && (
							<p
								role="status"
								className="alert alert-success alert-soft mt-5 text-sm"
							>
								{t('profile.passwordChanged')}
							</p>
						)}
						<div className="mt-6">
							<ChangePasswordForm
								mode="profile"
								labelledBy="profile-password"
								onChanged={() => setPasswordChanged(true)}
							/>
						</div>
					</section>
				</div>

				<div className="flex flex-col gap-6">
					<section className="rounded-box bg-base-200 p-6">
						<h2 className="font-semibold">{t('profile.accountDetails')}</h2>
						<dl className="mt-4 flex flex-col gap-4 text-sm">
							<DetailItem label={t('profile.username')} ltr>
								{user.username}
							</DetailItem>
							<DetailItem label={t('profile.email')} ltr>
								{user.email}
							</DetailItem>
							<DetailItem label={t('profile.memberSince')}>
								{formatDate(user.createdAt, i18n.language)}
							</DetailItem>
						</dl>
						<p className="mt-5 border-t border-base-300 pt-4 text-xs text-[var(--color-slate)]">
							{t('profile.adminOnly')}
						</p>
					</section>

					<section className="rounded-box bg-base-200 p-6">
						<h2 className="font-semibold">{t('profile.companies')}</h2>
						{workspaces.length === 0 && !platformAccess ? (
							<p className="mt-3 text-sm text-[var(--color-slate)]">
								{t('profile.noCompanies')}
							</p>
						) : (
							<ul className="mt-4 flex flex-col divide-y divide-base-300">
								{workspaces.map(({ id, slug, name: company, role }) => {
									const isCurrent = companySlug === slug;
									return (
										<li
											key={id}
											className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0"
										>
											<div className="min-w-0">
												<p className="truncate font-medium">
													<bdi>{company}</bdi>
												</p>
												<p className="text-xs text-[var(--color-slate)]">
													{roleName(role)}
												</p>
											</div>
											{isCurrent ? (
												<span className="badge badge-sm border-0 bg-primary text-primary-content">
													{t('profile.current')}
												</span>
											) : (
												<Link
													to={`/app/${slug}`}
													className="btn btn-ghost btn-sm shrink-0 bg-base-100"
													aria-label={t('picker.openCompanyNamed', {
														name: company,
													})}
												>
													{t('profile.open')}
												</Link>
											)}
										</li>
									);
								})}
								{platformAccess && (
									<li className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0">
										<div className="min-w-0">
											<p className="truncate font-medium">
												{t('profile.platform')}
											</p>
											<p className="text-xs text-[var(--color-slate)]">
												{t('switcher.platformRole')}
											</p>
										</div>
										{inPlatform ? (
											<span className="badge badge-sm border-0 bg-primary text-primary-content">
												{t('profile.current')}
											</span>
										) : (
											<Link
												to="/platform"
												className="btn btn-ghost btn-sm shrink-0 bg-base-100"
											>
												{t('profile.open')}
											</Link>
										)}
									</li>
								)}
							</ul>
						)}
					</section>
				</div>
			</div>
			<AccountActivitySection />
		</div>
	);
}
