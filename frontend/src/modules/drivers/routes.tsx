import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@components';

export const driversRoutes: RouteObject[] = [{
  path: 'drivers',
  element: <ModulePage title="Drivers" description="Coordinate couriers, duty status, and compliance." />,
}];
