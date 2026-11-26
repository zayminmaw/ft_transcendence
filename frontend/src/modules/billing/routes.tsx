import type { RouteObject } from 'react-router-dom';
import { CashHandoverPage } from './pages/CashHandoverPage';

// The cashier's page has its own sidebar link and permission (billing.reconcile_cod).
export const cashHandoverRoutes: RouteObject[] = [
	{ path: 'cash-handover', element: <CashHandoverPage /> },
];
