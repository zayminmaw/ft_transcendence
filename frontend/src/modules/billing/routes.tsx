import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@components';

export const billingRoutes: RouteObject[] = [{
  path: 'billing',
  element: <ModulePage title="Billing" description="Manage invoices, merchant ledgers, and COD settlements." />,
}];
