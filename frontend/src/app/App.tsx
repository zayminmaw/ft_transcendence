import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { AccountFooter, useCan, useCurrentWorkspace, WorkspaceSwitcher } from '@modules/auth';
import { getTenantNavigation } from './navigation';

// Rendered inside CompanyBoundary, so the company in the URL is always one of the user's.
export function App() {
	const { t } = useTranslation();
	const companyPath = useCompanyPath();
	const can = useCan();
	const workspace = useCurrentWorkspace();
	const name = workspace?.name ?? t('workspace.scope');
	return (
		<DashboardLayout
			scope={name}
			homeTo={companyPath()}
			groups={getTenantNavigation(t, companyPath(), can)}
			header={<WorkspaceSwitcher current={name} role={workspace?.role.name} />}
			footer={<AccountFooter />}
		/>
	);
}
