import type { RouteObject } from 'react-router-dom';
import { CreateUserPage } from './pages/CreateUserPage';
import { PeopleAccessPage } from './pages/PeopleAccessPage';

export const rbacRoutes: RouteObject[] = [
	{ path: 'rbac', element: <PeopleAccessPage /> },
	{ path: 'rbac/new', element: <CreateUserPage /> },
];
