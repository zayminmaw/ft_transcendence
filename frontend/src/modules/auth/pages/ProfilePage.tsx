import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Avatar } from '@global-components';
import { formatDate } from '@utils/format';
import { CenteredPage } from '../components/CenteredPage';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { DisplayNameForm } from '../components/DisplayNameForm';
import { LoadingScreen } from '../components/LoadingScreen';
import { shownName, useMe, useRoleName } from '../hooks';

// /profile: your own account, the same in every company. Username and login email are an admin's to change; you set
// your display name here.
export function ProfilePage() {
	const { t, i18n } = useTranslation('auth');
	const me = useMe();
	const roleName = useRoleName();
	const navigate = useNavigate();
	const location = useLocation();
	const [passwordChanged, setPasswordChanged] = useState(false);
	// Back to where you came from; opened directly (no earlier page in this tab), to the workspaces.
	const back = () => (location.key === 'default' ? navigate('/app') : navigate(-1));

	if (me.isPending) return <LoadingScreen />;
	if (me.isError)
		return (
			<CenteredPage title={t('profile.title')} description={t('picker.loadFailed')}>
				<button type="button" className="btn w-fit" onClick={() => void me.refetch()}>
					{t('picker.retry')}
				</button>
			</CenteredPage>
		);

	const { user, workspaces, platformAccess } = me.data;
	const name = shownName(user);
	return (
		<CenteredPage title={t('profile.title')} description={t('profile.description')}>
			<button type="button" className="link link-hover w-fit text-sm" onClick={back}>
				{t('profile.back')}
			</button>
			<section className="flex items-center gap-4 rounded-box bg-base-200 p-6">
				<Avatar name={name} seed={user.username} size="lg" />
				<div className="min-w-0">
					<h2 className="truncate text-xl font-semibold">{name}</h2>
					{user.displayName && (
						<p className="truncate text-sm text-[var(--color-slate)]">
							{user.username}
						</p>
					)}
				</div>
			</section>
			<section
				aria-labelledby="profile-about"
				className="flex flex-col gap-5 rounded-box bg-base-200 p-6"
			>
				<h2 id="profile-about" className="font-semibold">
					{t('profile.about')}
				</h2>
				<DisplayNameForm current={user.displayName} />
				<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
					<dt className="text-[var(--color-slate)]">{t('profile.username')}</dt>
					<dd className="truncate">{user.username}</dd>
					<dt className="text-[var(--color-slate)]">{t('profile.email')}</dt>
					<dd className="truncate">{user.email}</dd>
					<dt className="text-[var(--color-slate)]">{t('profile.memberSince')}</dt>
					<dd>{formatDate(user.createdAt, i18n.language)}</dd>
				</dl>
				<p className="text-xs text-[var(--color-slate)]">{t('profile.adminOnly')}</p>
			</section>
			<section
				aria-labelledby="profile-companies"
				className="flex flex-col gap-4 rounded-box bg-base-200 p-6"
			>
				<h2 id="profile-companies" className="font-semibold">
					{t('profile.companies')}
				</h2>
				{workspaces.length === 0 && !platformAccess ? (
					<p className="text-sm text-[var(--color-slate)]">{t('profile.noCompanies')}</p>
				) : (
					<ul className="flex flex-col gap-3">
						{workspaces.map(({ id, slug, name: company, role }) => (
							<li
								key={id}
								className="flex items-center justify-between gap-3 text-sm"
							>
								<span className="min-w-0">
									<span className="font-medium">{company}</span>
									<span className="text-[var(--color-slate)]">
										{' '}
										· {roleName(role)}
									</span>
								</span>
								<Link
									to={`/app/${slug}`}
									className="btn btn-ghost btn-sm bg-base-100"
									aria-label={t('picker.openCompanyNamed', { name: company })}
								>
									{t('profile.open')}
								</Link>
							</li>
						))}
						{platformAccess && (
							<li className="flex items-center justify-between gap-3 text-sm">
								<span className="font-medium">{t('profile.platform')}</span>
								<Link to="/platform" className="btn btn-ghost btn-sm bg-base-100">
									{t('profile.open')}
								</Link>
							</li>
						)}
					</ul>
				)}
			</section>
			<section
				aria-labelledby="profile-password"
				className="flex flex-col gap-4 rounded-box bg-base-200 p-6"
			>
				<div>
					<h2 id="profile-password" className="font-semibold">
						{t('profile.password')}
					</h2>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{t('profile.passwordIntro')}
					</p>
				</div>
				{passwordChanged && (
					<p role="status" className="alert alert-success alert-soft text-sm">
						{t('profile.passwordChanged')}
					</p>
				)}
				<ChangePasswordForm mode="profile" onChanged={() => setPasswordChanged(true)} />
			</section>
		</CenteredPage>
	);
}
