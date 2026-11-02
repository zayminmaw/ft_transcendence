import type { RouteObject } from 'react-router-dom';
import { AssignDriverPage } from './pages/AssignDriverPage';
import { CreateParcelPage } from './pages/CreateParcelPage';
import { DispatchPage } from './pages/DispatchPage';
import { ParcelDetailsPage } from './pages/ParcelDetailsPage';
import { RecordDeliveryPage } from './pages/RecordDeliveryPage';
import { TrackParcelPage } from './pages/TrackParcelPage';

export const parcelsRoutes: RouteObject[] = [
	{ path: 'parcels', element: <DispatchPage /> },
	{ path: 'parcels/new', element: <CreateParcelPage /> },
	{ path: 'parcels/assign', element: <AssignDriverPage /> },
	{ path: 'parcels/:parcelId', element: <ParcelDetailsPage /> },
	{ path: 'parcels/:parcelId/deliver', element: <RecordDeliveryPage /> },
];

// Open to anyone, outside the workspace.
export const parcelTrackingRoutes: RouteObject[] = [
	{ path: 'track/:trackingNumber?', element: <TrackParcelPage /> },
];
