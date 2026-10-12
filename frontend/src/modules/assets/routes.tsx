import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@components';

export const assetsRoutes: RouteObject[] = [
	{
		path: 'assets',
		element: (
			<ModulePage
				title="Assets"
				description="Track your fleet, equipment, and maintenance."
			/>
		),
	},
];
