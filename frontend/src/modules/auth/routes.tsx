import type { RouteObject } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';

export const authRoutes: RouteObject[] = [
	{ path: 'login', element: <LoginPage /> },
	{ path: 'signup', element: <SignupPage /> },
];
