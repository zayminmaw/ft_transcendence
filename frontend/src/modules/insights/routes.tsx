import type { RouteObject } from 'react-router-dom';
import { InsightsPage } from './pages/InsightsPage';

export const insightsRoutes: RouteObject[] = [{ path: 'activity', element: <InsightsPage /> }];
