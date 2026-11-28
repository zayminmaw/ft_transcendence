import type { RouteObject } from 'react-router-dom';
import { CashHandoverPage } from './pages/CashHandoverPage';
import { InvoicesPage } from './pages/InvoicesPage';

// The cashier's page has its own sidebar link and permission (billing.reconcile_cod).
export const cashHandoverRoutes: RouteObject[] = [
	{ path: 'cash-handover', element: <CashHandoverPage /> },
];

// Company-wide invoices register and CSV export (billing.create_invoice).
export const invoicesRoutes: RouteObject[] = [{ path: 'invoices', element: <InvoicesPage /> }];
