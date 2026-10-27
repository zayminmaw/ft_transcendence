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
				<LogOutIcon />
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

// A door with an arrow leaving it; mirrored in right-to-left languages so the arrow points out.
function LogOutIcon() {
	return (
		<svg
			aria-hidden="true"
			className="h-[1.1em] rtl:-scale-x-100"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
			<path d="m16 17 5-5-5-5" />
			<path d="M21 12H9" />
		</svg>
	);
}
