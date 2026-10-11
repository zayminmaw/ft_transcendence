import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@components';

export const rbacRoutes: RouteObject[] = [{
  path: 'rbac',
  element: <ModulePage title="Access control" description="Manage user roles and access permissions." />,
}];
