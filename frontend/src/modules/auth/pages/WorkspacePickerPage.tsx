import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@global-components';
import { CenteredPage } from '../components/CenteredPage';
import { LoadingScreen } from '../components/LoadingScreen';
import { useLogout, useMe } from '../hooks';

export function WorkspacePickerPage() {
	const { t } = useTranslation('auth');
	const me = useMe({ refetchOnMount: 'always' });
	const logout = useLogout();
	const logOutButton = (
		<button
			type="button"
			className="btn btn-ghost w-fit bg-base-200"
			disabled={logout.isPending}
			onClick={() => logout.mutate()}
		>
			{t('account.logOut')}
		</button>
	);

	if (me.isPending) return <LoadingScreen />;
	if (me.isError)
		return (
			<CenteredPage title={t('picker.title')} description={t('picker.loadFailed')}>
				<div className="flex flex-wrap gap-3">
					<Button className="w-fit" onClick={() => void me.refetch()}>
						{t('picker.retry')}
					</Button>
					{logOutButton}
				</div>
			</CenteredPage>
		);

	const { workspaces, platformAccess } = me.data;
	if (workspaces.length === 0 && !platformAccess)
		return (
			<CenteredPage title={t('noAccess.title')} description={t('noAccess.description')}>
				{logOutButton}
			</CenteredPage>
		);

	return (
		<CenteredPage title={t('picker.title')} description={t('picker.intro')}>
			<ul className="flex flex-col gap-6">
				{workspaces.map(({ id, slug, name }) => (
					<li key={id} className="rounded-box bg-base-200 p-6">
						<h2 className="font-semibold">{name}</h2>
						<p className="mt-3 text-sm text-[var(--color-slate)]">
							{t('picker.companyDescription')}
						</p>
						<Link
							to={`/app/${slug}`}
							className="btn btn-primary mt-4 w-full sm:w-80"
							aria-label={t('picker.openCompanyNamed', { name })}
						>
							{t('picker.openCompany')}
						</Link>
					</li>
				))}
				{platformAccess && (
					<li className="rounded-box bg-base-200 p-6">
						<h2 className="font-semibold">{t('picker.platformTitle')}</h2>
						<p className="mt-3 text-sm text-[var(--color-slate)]">
							{t('picker.platformDescription')}
						</p>
						<Link to="/platform" className="btn btn-neutral mt-4 w-full sm:w-80">
							{t('picker.openPlatform')}
						</Link>
					</li>
				)}
			</ul>
			{logOutButton}
		</CenteredPage>
	);
}
