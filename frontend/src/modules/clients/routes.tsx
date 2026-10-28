import type { RouteObject } from 'react-router-dom';
import { RequirePermission } from '@modules/auth';
import { ClientDetailsPage } from './pages/ClientDetailsPage';
import { ClientsPage } from './pages/ClientsPage';
import { CreateClientPage } from './pages/CreateClientPage';
import { EditClientPage } from './pages/EditClientPage';

// Every page also needs clients.view (app/routes.tsx); creating and editing need their own permission.
export const clientsRoutes: RouteObject[] = [
	{ path: 'clients', element: <ClientsPage /> },
	{
		path: 'clients/new',
		element: (
			<RequirePermission permission="clients.create" label="workspace.nav.clients">
				<CreateClientPage />
			</RequirePermission>
		),
	},
	{ path: 'clients/:clientId', element: <ClientDetailsPage /> },
	{
		path: 'clients/:clientId/edit',
		element: (
			<RequirePermission permission="clients.edit" label="workspace.nav.clients">
				<EditClientPage />
			</RequirePermission>
		),
	},
];
