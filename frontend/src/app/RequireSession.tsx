import { Navigate, Outlet } from 'react-router-dom';
import { LoadingScreen, ServerUnavailable } from '@modules/auth';
import { useAuth } from '@hooks/useAuth';
import { useSessionCheck } from '@hooks/useSessionCheck';

// Pages behind a login. Without a session, or once it ends, the visitor goes to /login. When the server can't be
// reached the session may still be fine, so the page offers Try again instead.
export function RequireSession() {
	const { accessToken, ended } = useAuth();
	const { checking, unavailable, retry } = useSessionCheck();

	if (accessToken) return <Outlet />;
	if (checking) return <LoadingScreen />;
	if (unavailable) return <ServerUnavailable onRetry={retry} />;
	return <Navigate to="/login" replace state={{ ended }} />;
}
