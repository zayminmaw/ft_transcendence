import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '@modules/auth';

// Everything behind a login except /change-password: an account that must still replace an admin-given password is
// sent there first, also from a pasted link. The API refuses its other requests anyway (403
// AUTH_PASSWORD_CHANGE_REQUIRED); this only takes the person to the right page. It shows nothing of its own while /me
// loads: the pages below (the picker, CompanyBoundary, RequirePlatform) wait for /me themselves, and a loading screen
// here would unmount them each time /me is fetched again, so a failing /me would load forever.
export function RequirePasswordChosen() {
	const me = useMe();
	if (me.data?.mustChangePassword) return <Navigate to="/change-password" replace />;
	return <Outlet />;
}
