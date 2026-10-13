import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@components';
import TenantsList from './pages/TenantsList';

export const organizationsRoutes: RouteObject[] = [
	{
		path: 'organizations',
		element: <TenantsList />,
	},
];
