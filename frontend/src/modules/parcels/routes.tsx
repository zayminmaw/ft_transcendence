import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@components';

export const parcelsRoutes: RouteObject[] = [
	{
		path: 'parcels',
		element: (
			<ModulePage
				title="Parcels"
				description="Follow shipments from pickup through delivery."
			/>
		),
	},
];
