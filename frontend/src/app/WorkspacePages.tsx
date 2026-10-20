import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { ModulePage } from '@global-components';

// The router is built when routes.tsx loads, so translated pages need their own components.
export function OverviewPage() {
	const { t } = useTranslation();
	return (
		<ModulePage
			title={t('workspace.overview.title')}
			description={t('workspace.overview.description')}
		/>
	);
}

export function NotFoundPage() {
	const { t } = useTranslation();
	return (
		<ModulePage
			title={t('workspace.notFound.title')}
			description={t('workspace.notFound.description')}
		/>
	);
}

// Old short URLs (/parcels) don't name a company, so they go to the workspace picker.
export function CompatibilityRedirect() {
	return <Navigate to="/app" replace />;
}
