import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@global-components';
import { getTenantNavigation } from './navigation';

export function App() {
	const { t } = useTranslation();
	return (
		<DashboardLayout
			scope={t('workspace.scope')}
			homeTo="/app"
			groups={getTenantNavigation(t)}
		/>
	);
}
