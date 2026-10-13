import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@components';

export const staffRoutes: RouteObject[] = [
	{
		path: 'staff',
		element: (
			<ModulePage
				title="Staff"
				description="Manage office personnel and employment records."
			/>
		),
	},
];
