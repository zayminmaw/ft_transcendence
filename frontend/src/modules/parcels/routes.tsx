import type { RouteObject } from 'react-router-dom';
import { AssignDriverPage } from './pages/AssignDriverPage';
import { DispatchPage } from './pages/DispatchPage';
import { ParcelDetailsPage } from './pages/ParcelDetailsPage';

export const parcelsRoutes: RouteObject[] = [
	{ path: 'parcels', element: <DispatchPage /> },
	{ path: 'parcels/assign', element: <AssignDriverPage /> },
	{ path: 'parcels/:parcelId', element: <ParcelDetailsPage /> },
];
