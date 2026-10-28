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
import { platformRoutes } from '@modules/platform';
import { authRoutes, ChangePasswordPage, WorkspacePickerPage } from '@modules/auth';
import { App } from './App';
import { CompanyBoundary } from './CompanyBoundary';
import { RequirePasswordChosen } from './RequirePasswordChosen';
import { RequirePlatform } from './RequirePlatform';
import { RequireSession } from './RequireSession';
import { CompatibilityRedirect, NotFoundPage, OverviewPage } from './WorkspacePages';

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
