import { createBrowserRouter } from 'react-router-dom';
import { organizationsRoutes } from '@modules/organizations';
import { clientsRoutes } from '@modules/clients';
import { staffRoutes } from '@modules/staff';
import { driversRoutes } from '@modules/drivers';
import { assetsRoutes } from '@modules/assets';
import { parcelsRoutes } from '@modules/parcels';
import { billingRoutes } from '@modules/billing';
import { rbacRoutes } from '@modules/rbac';
import { marketingRoutes } from '@modules/marketing';
import { ModulePage } from '@components';
import { App } from './App';

const workspaceRoutes = [
	...organizationsRoutes, ...clientsRoutes, ...staffRoutes, ...driversRoutes,
	...assetsRoutes, ...parcelsRoutes, ...billingRoutes, ...rbacRoutes,
];

export const router = createBrowserRouter([
	...marketingRoutes,
	{
		path: 'app',
		element: <App />,
		children: [
			{ index: true, element: <ModulePage title="Your operations workspace" description="Choose a module to explore the workspace." /> },
			...workspaceRoutes,
			{ path: '*', element: <ModulePage title="Page not found" description="Choose a module from the navigation to continue." /> },
		],
	},
	// Preserve the original module URLs while the workspace moves under /app.
	{ element: <App />, children: workspaceRoutes },
]);
