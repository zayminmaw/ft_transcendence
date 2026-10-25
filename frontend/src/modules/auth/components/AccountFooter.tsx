import { useTranslation } from 'react-i18next';
import { useLogout } from '../hooks';

// The bottom of the sidebar: the way out. Who is logged in shows in the card at the top (WorkspaceSwitcher).
export function AccountFooter() {
	const { t } = useTranslation('auth');
	const logout = useLogout();

	return (
		<div>
			<button
				type="button"
				className="btn btn-ghost btn-sm"
				disabled={logout.isPending}
				onClick={() => logout.mutate()}
			>
				{t('account.logOut')}
			</button>
			{logout.isError && (
				<p role="alert" className="mt-2 text-xs text-error">
					{t('account.logOutFailed')}
				</p>
			)}
		</div>
	);
}
