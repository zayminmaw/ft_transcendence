import type { RouteObject } from 'react-router-dom';
import { MarketingLayout } from './components/MarketingLayout';
import { LandingPage } from './pages/LandingPage';
import { ProductPage } from './pages/ProductPage';
import { SolutionsPage } from './pages/SolutionsPage';
import { ContactPage } from './pages/ContactPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const marketingRoutes: RouteObject[] = [{
	element: <MarketingLayout />,
	children: [
		{ index: true, element: <LandingPage /> },
		{ path: 'product', element: <ProductPage /> },
		{ path: 'solutions', element: <SolutionsPage /> },
		{ path: 'contact', element: <ContactPage /> },
		{ path: '*', element: <NotFoundPage /> },
	],
}];
