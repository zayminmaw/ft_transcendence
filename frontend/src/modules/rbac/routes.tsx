import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@global-components';

export const rbacRoutes: RouteObject[] = [
	{
		path: 'rbac',
		element: (
			<ModulePage
				title="Access control"
				description="Manage user accounts, organization roles, and access permissions."
			/>
		),
	},
];
