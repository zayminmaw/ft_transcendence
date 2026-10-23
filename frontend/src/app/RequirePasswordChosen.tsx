import { Navigate, Outlet } from 'react-router-dom';
import { LoadingScreen, useMe } from '@modules/auth';

// Everything behind a login except /change-password: an account that must still replace an admin-given password is
// sent there first, also from a pasted link. The API refuses its other requests anyway (403
// AUTH_PASSWORD_CHANGE_REQUIRED); this only takes the person to the right page, so a failed /me lets the page and its
// own error handling through.
export function RequirePasswordChosen() {
	const me = useMe();
	if (me.isPending) return <LoadingScreen />;
	if (me.data?.mustChangePassword) return <Navigate to="/change-password" replace />;
	return <Outlet />;
}
