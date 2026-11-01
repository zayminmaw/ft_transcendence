import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { CenteredPage } from '../components/CenteredPage';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { LoadingScreen } from '../components/LoadingScreen';
import { useLogout, useMe } from '../hooks';

// /change-password: an account whose password an admin gave or reset chooses its own before anything else. Without
// the flag there is nothing to do here yet (changing your password any time comes with the profile page).
export function ChangePasswordPage() {
	const { t } = useTranslation('auth');
	const me = useMe();
	const logout = useLogout();

	if (me.isPending) return <LoadingScreen />;
	if (me.isSuccess && !me.data.mustChangePassword) return <Navigate to="/app" replace />;

	return (
		<CenteredPage title={t('changePassword.title')} description={t('changePassword.intro')}>
			<ChangePasswordForm mode="firstLogin" />
			<button
				type="button"
				className="link link-hover w-fit text-sm"
				disabled={logout.isPending}
				onClick={() => logout.mutate()}
			>
				{t('account.logOut')}
			</button>
		</CenteredPage>
	);
}
