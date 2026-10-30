import type { RouteObject } from 'react-router-dom';
import { RequirePermission } from '@modules/auth';
import { CreateDriverPage } from './pages/CreateDriverPage';
import { DriverDetailsPage } from './pages/DriverDetailsPage';
import { DriversPage } from './pages/DriversPage';
import { EditDriverPage } from './pages/EditDriverPage';

// Every page also needs drivers.view (app/routes.tsx); onboarding and editing need drivers.manage.
export const driversRoutes: RouteObject[] = [
	{ path: 'drivers', element: <DriversPage /> },
	{
		path: 'drivers/new',
		element: (
			<RequirePermission permission="drivers.manage" label="workspace.nav.drivers">
				<CreateDriverPage />
			</RequirePermission>
		),
	},
	{ path: 'drivers/:driverId', element: <DriverDetailsPage /> },
	{
		path: 'drivers/:driverId/edit',
		element: (
			<RequirePermission permission="drivers.manage" label="workspace.nav.drivers">
				<EditDriverPage />
			</RequirePermission>
		),
	},
];
