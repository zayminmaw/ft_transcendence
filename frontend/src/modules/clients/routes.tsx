import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@components';

export const clientsRoutes: RouteObject[] = [
	{
		path: 'clients',
		element: (
			<ModulePage
				title="Clients"
				description="Keep merchant contacts and account details together."
			/>
		),
	},
];
