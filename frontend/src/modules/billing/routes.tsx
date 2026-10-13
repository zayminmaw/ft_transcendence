import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@global-components';

export const billingRoutes: RouteObject[] = [
	{
		path: 'billing',
		element: (
			<ModulePage
				title="Billing & COD"
				description="Manage invoices, merchant ledgers, and COD settlements."
			/>
		),
	},
];
