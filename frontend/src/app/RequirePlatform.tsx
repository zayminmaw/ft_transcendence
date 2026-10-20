import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { LoadingScreen, useMe } from '@modules/auth';
import { setActiveOrganization, useActiveOrganization } from '@hooks/useActiveOrganization';

// Platform pages need the separate platform role; a company role never grants it. So their requests never carry a
// company: the last one opened is dropped before they render.
export function RequirePlatform() {
	const me = useMe();
	const { activeOrganizationId } = useActiveOrganization();

	useEffect(() => {
		if (activeOrganizationId !== null) void setActiveOrganization(null);
	}, [activeOrganizationId]);

	if (me.isPending || activeOrganizationId !== null) return <LoadingScreen />;
	if (!me.data?.platformAccess) return <Navigate to="/app" replace />;
	return <Outlet />;
}
