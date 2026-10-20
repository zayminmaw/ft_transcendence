import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { AccountFooter, useCurrentWorkspace, WorkspaceSwitcher } from '@modules/auth';
import { getTenantNavigation } from './navigation';

// Rendered inside CompanyBoundary, so the company in the URL is always one of the user's.
export function App() {
	const { t } = useTranslation();
	const companyPath = useCompanyPath();
	const name = useCurrentWorkspace()?.name ?? t('workspace.scope');
	return (
		<DashboardLayout
			scope={name}
			homeTo={companyPath()}
			groups={getTenantNavigation(t, companyPath())}
			header={<WorkspaceSwitcher current={name} />}
			footer={<AccountFooter />}
		/>
	);
}
