import { Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@global-components';
import { PlatformLayout } from './components/PlatformLayout';
import { TenantsPage } from './pages/TenantsPage';
import { TenantActivityPage } from './pages/TenantActivityPage';
import { CreateTenantPage } from './pages/CreateTenantPage';
import { TenantDetailsPage } from './pages/TenantDetailsPage';
import { TenantAdministratorsPage } from './pages/TenantAdministratorsPage';

// Layout routes only. Authentication and platform authorization are separate future work.
export const platformRoutes: RouteObject[] = [
	{
		path: 'platform',
		element: <PlatformLayout />,
		children: [
			{ index: true, element: <Navigate to="/platform/tenants" replace /> },
			{ path: 'tenants', element: <TenantsPage /> },
			{ path: 'activity', element: <TenantActivityPage /> },
			{ path: 'tenants/new', element: <CreateTenantPage /> },
			{ path: 'tenants/:tenantId', element: <TenantDetailsPage /> },
			{ path: 'tenants/:tenantId/administrators', element: <TenantAdministratorsPage /> },
			{
				path: '*',
				element: (
					<ModulePage
						title="Page not found"
						description="Choose a page from the platform navigation to continue."
					/>
				),
			},
		],
	},
];
