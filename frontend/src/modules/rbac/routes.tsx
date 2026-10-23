import type { RouteObject } from 'react-router-dom';
import { PeopleAccessPage } from './pages/PeopleAccessPage';

export const rbacRoutes: RouteObject[] = [{ path: 'rbac', element: <PeopleAccessPage /> }];
