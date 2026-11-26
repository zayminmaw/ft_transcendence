import { Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { PlatformLayout } from './components/PlatformLayout';
import { SigninsPage } from './pages/SigninsPage';
import { TenantsPage } from './pages/TenantsPage';
import { TenantActivityPage } from './pages/TenantActivityPage';
import { CreateTenantPage } from './pages/CreateTenantPage';
import { TenantDetailsPage } from './pages/TenantDetailsPage';
import { TenantAdministratorsPage } from './pages/TenantAdministratorsPage';
import { PlatformNotFoundPage } from './pages/PlatformNotFoundPage';

// Layout routes only. Authentication and platform authorization are separate future work.
export const platformRoutes: RouteObject[] = [
	{
		path: 'platform',
		element: <PlatformLayout />,
		children: [
			{ index: true, element: <Navigate to="/platform/tenants" replace /> },
			{ path: 'tenants', element: <TenantsPage /> },
			{ path: 'activity', element: <TenantActivityPage /> },
			{ path: 'signins', element: <SigninsPage /> },
			{ path: 'tenants/new', element: <CreateTenantPage /> },
			{ path: 'tenants/:tenantId', element: <TenantDetailsPage /> },
			{ path: 'tenants/:tenantId/administrators', element: <TenantAdministratorsPage /> },
			{
				path: '*',
				element: <PlatformNotFoundPage />,
			},
		],
	},
];
