import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@global-components';

export const assetsRoutes: RouteObject[] = [
	{
		path: 'assets',
		element: (
			<ModulePage
				title="Fleet & assets"
				description="Track your fleet, equipment, and maintenance."
			/>
		),
	},
];
