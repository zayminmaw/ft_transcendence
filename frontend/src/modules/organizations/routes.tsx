import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@global-components';

export const organizationsRoutes: RouteObject[] = [
	{
		path: 'organizations',
		element: (
			<ModulePage
				title="Organization settings"
				description="Organization details and team memberships within your tenant."
			/>
		),
	},
];
