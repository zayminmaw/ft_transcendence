import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';
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

// Forwards the real URL, so dynamic segments like `parcels/:parcelId` keep their values.
export function CompatibilityRedirect() {
	const { pathname, search } = useLocation();
	return <Navigate to={`/app${pathname}${search}`} replace />;
}
