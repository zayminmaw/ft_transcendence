import type { RouteObject } from 'react-router-dom';
import { RequirePermission } from '@modules/auth';
import { CreateUserPage } from './pages/CreateUserPage';
import { PeopleAccessPage } from './pages/PeopleAccessPage';

// The app wraps every rbac route in admin.manage_users (app/navigation.ts); seeing the roles needs admin.manage_roles too.
export const rbacRoutes: RouteObject[] = [
	{ path: 'rbac', element: <PeopleAccessPage /> },
	{ path: 'rbac/new', element: <CreateUserPage /> },
	{
		path: 'rbac/roles',
		element: (
			<RequirePermission permission="admin.manage_roles" label="workspace.nav.rbac">
				<PeopleAccessPage tab="roles" />
			</RequirePermission>
		),
	},
];
