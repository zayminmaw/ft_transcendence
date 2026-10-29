import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { organizationsRoutes } from '@modules/organizations';
import { clientsRoutes } from '@modules/clients';
import { staffRoutes } from '@modules/staff';
import { driversRoutes } from '@modules/drivers';
import { assetsRoutes } from '@modules/assets';
import { parcelsRoutes } from '@modules/parcels';
import { billingRoutes } from '@modules/billing';
import { rbacRoutes } from '@modules/rbac';
import { auditRoutes } from '@modules/audit';
import { marketingRoutes } from '@modules/marketing';
import { platformRoutes } from '@modules/platform';
import {
	authRoutes,
	ChangePasswordPage,
	RequirePermission,
	WorkspacePickerPage,
} from '@modules/auth';
import { App } from './App';
import { CompanyBoundary } from './CompanyBoundary';
import { MODULE_ACCESS } from './navigation';
import { RequirePasswordChosen } from './RequirePasswordChosen';
import { RequirePlatform } from './RequirePlatform';
import { RequireSession } from './RequireSession';
import { CompatibilityRedirect, NotFoundPage, OverviewPage } from './WorkspacePages';

// Every module page needs what its sidebar link needs; a pasted link without it shows "no access".
const allowed = (module: keyof typeof MODULE_ACCESS, routes: RouteObject[]) =>
	routes.map((route) => ({
		...route,
		element: <RequirePermission {...MODULE_ACCESS[module]}>{route.element}</RequirePermission>,
	}));

const workspaceRoutes = [
	...allowed('organizations', organizationsRoutes),
	...allowed('clients', clientsRoutes),
	...allowed('staff', staffRoutes),
	...allowed('drivers', driversRoutes),
	...allowed('assets', assetsRoutes),
	...allowed('parcels', parcelsRoutes),
	...allowed('billing', billingRoutes),
	...allowed('rbac', rbacRoutes),
	// The audit page checks admin.audit_logs itself (see AuditLogPage).
	...auditRoutes,
];

export const router = createBrowserRouter([
	...marketingRoutes,
	...authRoutes,
	{
		element: <RequireSession />,
		children: [
			{ path: 'change-password', element: <ChangePasswordPage /> },
			{
				element: <RequirePasswordChosen />,
				children: [
					{
						path: 'app',
						children: [
							{ index: true, element: <WorkspacePickerPage /> },
							{
								path: ':companySlug',
								element: <CompanyBoundary />,
								children: [
									{
										element: <App />,
										children: [
											{ index: true, element: <OverviewPage /> },
											...workspaceRoutes,
											{ path: '*', element: <NotFoundPage /> },
										],
									},
								],
							},
						],
					},
					{ element: <RequirePlatform />, children: platformRoutes },
				],
			},
		],
	},
	...workspaceRoutes.map(({ path }) => ({ path, element: <CompatibilityRedirect /> })),
]);
