import { useTranslation } from 'react-i18next';
import { useLogout, useMe } from '../hooks';

// The bottom of the sidebar: who is logged in, and the way out.
export function AccountFooter() {
	const { t } = useTranslation('auth');
	const user = useMe().data?.user;
	const logout = useLogout();

	return (
		<div className="flex items-center justify-between gap-3 border-t border-base-300 pt-4">
			<p className="min-w-0 truncate text-sm font-medium" title={user?.email}>
				{user?.username}
			</p>
			<button
				type="button"
				className="btn btn-ghost btn-sm"
				disabled={logout.isPending}
				onClick={() => logout.mutate()}
			>
				{t('account.logOut')}
			</button>
		</div>
	);
}
