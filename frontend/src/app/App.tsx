import { DashboardLayout } from '@global-components';
import { tenantNavigation } from './navigation';

export function App() {
	return <DashboardLayout scope="Tenant workspace" homeTo="/app" groups={tenantNavigation} />;
}
