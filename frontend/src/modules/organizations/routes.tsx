import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@components';

export const organizationsRoutes: RouteObject[] = [{
  path: 'organizations',
  element: <ModulePage title="Organizations" description="Manage organizations and team memberships." />,
}];
