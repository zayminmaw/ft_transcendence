import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router-dom';
import { CenteredPage, LoadingScreen, useCurrentWorkspace, useMe } from '@modules/auth';
import { setActiveOrganization, useActiveOrganization } from '@hooks/useActiveOrganization';

// /app/:companySlug: opens the company named in the URL. Its pages render only once every request carries that
// company, and a slug that isn't yours looks the same as one that doesn't exist.
export function CompanyBoundary() {
	const { t } = useTranslation('auth');
	const me = useMe();
	const workspace = useCurrentWorkspace();
	const { activeOrganizationId } = useActiveOrganization();

	useEffect(() => {
		if (workspace && workspace.id !== activeOrganizationId)
			void setActiveOrganization(workspace.id);
	}, [workspace, activeOrganizationId]);

	if (me.isPending) return <LoadingScreen />;
	if (!workspace)
		return (
			<CenteredPage title={t('notFound.title')} description={t('notFound.description')}>
				<Link to="/app" className="btn btn-primary w-fit">
					{t('switcher.allWorkspaces')}
				</Link>
			</CenteredPage>
		);
	if (workspace.id !== activeOrganizationId) return <LoadingScreen />;
	return <Outlet />;
}
