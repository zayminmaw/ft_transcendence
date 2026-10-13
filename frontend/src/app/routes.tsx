import { createBrowserRouter, Navigate } from 'react-router-dom';
import { organizationsRoutes } from '@modules/organizations';
import { clientsRoutes } from '@modules/clients';
import { staffRoutes } from '@modules/staff';
import { driversRoutes } from '@modules/drivers';
import { assetsRoutes } from '@modules/assets';
import { parcelsRoutes } from '@modules/parcels';
import { billingRoutes } from '@modules/billing';
import { rbacRoutes } from '@modules/rbac';
import { marketingRoutes } from '@modules/marketing';
import { platformRoutes } from '@modules/platform';
import { ModulePage } from '@global-components';
import { App } from './App';

const workspaceRoutes = [
	...organizationsRoutes,
	...clientsRoutes,
	...staffRoutes,
	...driversRoutes,
	...assetsRoutes,
	...parcelsRoutes,
	...billingRoutes,
	...rbacRoutes,
];

export const router = createBrowserRouter([
	...marketingRoutes,
	...platformRoutes,
	{
		path: 'app',
		element: <App />,
		children: [
			{
				index: true,
				element: (
					<ModulePage
						title="Operations overview"
						description="Delivery, cash reconciliation, and team responsibilities."
					/>
				),
			},
			...workspaceRoutes,
			{
				path: '*',
				element: (
					<ModulePage
						title="Page not found"
						description="Choose a module from the navigation to continue."
					/>
				),
			},
		],
	},
	// Keep compatibility URLs inside the canonical tenant layout and future auth boundary.
	...workspaceRoutes.map(({ path }) => ({
		path,
		element: <Navigate to={`/app/${path}`} replace />,
	})),
]);
