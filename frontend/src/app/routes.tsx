import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { clientsRoutes } from '@modules/clients';
import { driversRoutes } from '@modules/drivers';
import { assetsRoutes } from '@modules/assets';
import { parcelsRoutes, parcelTrackingRoutes } from '@modules/parcels';
import { cashHandoverRoutes, invoicesRoutes } from '@modules/billing';
import { rbacRoutes } from '@modules/rbac';
import { contactsRoutes } from '@modules/contacts';
import { auditRoutes } from '@modules/audit';
import { insightsRoutes } from '@modules/insights';
import { MarketingLayout, marketingRoutes } from '@modules/marketing';
import { platformRoutes } from '@modules/platform';
import {
	AccountLayout,
	authRoutes,
	ChangePasswordPage,
	ProfilePage,
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
	...allowed('clients', clientsRoutes),
	...allowed('drivers', driversRoutes),
	...allowed('assets', assetsRoutes),
	...allowed('parcels', parcelsRoutes),
	...allowed('cash-handover', cashHandoverRoutes),
	...allowed('invoices', invoicesRoutes),
	...allowed('rbac', rbacRoutes),
	...allowed('contacts', contactsRoutes),
	// The audit page checks admin.audit_logs itself (see AuditLogPage).
	...auditRoutes,
	// Needs admin.audit_logs too, and the page shows its own "no access".
	...insightsRoutes,
];

export const router = createBrowserRouter([
	...marketingRoutes,
	{ element: <MarketingLayout />, children: parcelTrackingRoutes },
	...authRoutes,
	{
		element: <RequireSession />,
		children: [
			{ path: 'change-password', element: <ChangePasswordPage /> },
			{
				element: <RequirePasswordChosen />,
				children: [
					// Direct /profile visits render inside the standard DashboardLayout via AccountLayout.
					{
						element: <AccountLayout />,
						children: [{ path: 'profile', element: <ProfilePage /> }],
					},
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
											{ path: 'profile', element: <ProfilePage /> },
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
