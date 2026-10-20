import { Navigate, Outlet } from 'react-router-dom';
import { LoadingScreen } from '@modules/auth';
import { useAuth } from '@hooks/useAuth';
import { useSessionCheck } from '@hooks/useSessionCheck';

// Pages behind a login. Without a session, or once it ends, the visitor goes to /login.
export function RequireSession() {
	const { accessToken, ended } = useAuth();
	const checking = useSessionCheck();

	if (accessToken) return <Outlet />;
	if (checking) return <LoadingScreen />;
	return <Navigate to="/login" replace state={{ ended }} />;
}
