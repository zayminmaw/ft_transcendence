import { Navigate, Outlet } from 'react-router-dom';
import { LoadingScreen, useMe } from '@modules/auth';

// Platform pages need the separate platform role; a company role never grants it.
export function RequirePlatform() {
	const me = useMe();
	if (me.isPending) return <LoadingScreen />;
	if (!me.data?.platformAccess) return <Navigate to="/app" replace />;
	return <Outlet />;
}
