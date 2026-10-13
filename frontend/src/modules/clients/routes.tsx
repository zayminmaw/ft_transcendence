import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@global-components';

export const clientsRoutes: RouteObject[] = [
	{
		path: 'clients',
		element: (
			<ModulePage
				title="Clients / merchants"
				description="Keep merchant contacts and account details together."
			/>
		),
	},
];
