import type { RouteObject } from 'react-router-dom';
import { RequirePermission } from '@modules/auth';
import { AssetDetailsPage } from './pages/AssetDetailsPage';
import { AssetsPage } from './pages/AssetsPage';
import { CreateAssetPage } from './pages/CreateAssetPage';
import { EditAssetPage } from './pages/EditAssetPage';

// Every page also needs assets.view (app/routes.tsx); adding and editing need assets.create.
export const assetsRoutes: RouteObject[] = [
	{ path: 'assets', element: <AssetsPage /> },
	{
		path: 'assets/new',
		element: (
			<RequirePermission permission="assets.create" label="workspace.nav.assets">
				<CreateAssetPage />
			</RequirePermission>
		),
	},
	{ path: 'assets/:assetId', element: <AssetDetailsPage /> },
	{
		path: 'assets/:assetId/edit',
		element: (
			<RequirePermission permission="assets.create" label="workspace.nav.assets">
				<EditAssetPage />
			</RequirePermission>
		),
	},
];
