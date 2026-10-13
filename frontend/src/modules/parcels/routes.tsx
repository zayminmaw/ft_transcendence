import type { RouteObject } from 'react-router-dom';
import { ModulePage } from '@global-components';

export const parcelsRoutes: RouteObject[] = [
	{
		path: 'parcels',
		element: (
			<ModulePage
				title="Dispatch & parcels"
				description="Follow shipments from pickup through delivery."
			/>
		),
	},
];
