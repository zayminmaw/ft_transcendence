import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import { useMe } from '../hooks';

// The open company (NavLink's aria-current) is marked light grey like the sidebar's current page, instead of
// daisyUI's dark default.
const MENU_COLORS =
	'[--menu-active-bg:var(--color-base-200)] [--menu-active-fg:var(--color-base-content)]';

// The card at the top of the sidebar: the open workspace, and a menu to move to another one.
export function WorkspaceSwitcher({ current }: { current: string }) {
	const { t } = useTranslation('auth');
	const workspaces = useMe().data?.workspaces ?? [];
	const menu = useRef<HTMLDetailsElement>(null);
	const close = () => menu.current?.removeAttribute('open');

	return (
		<details ref={menu} className="dropdown w-full">
			<summary className="flex cursor-pointer list-none flex-col rounded-xl bg-base-200 p-3 [&::-webkit-details-marker]:hidden">
				<span className="text-sm font-medium">{current}</span>
				<span className="mt-1 text-xs text-[var(--color-slate)]">
					{t('switcher.change')}
				</span>
			</summary>
			<ul
				className={`menu dropdown-content z-10 mt-2 w-full rounded-box border border-base-300 bg-base-100 p-2 ${MENU_COLORS}`}
			>
				{workspaces.map(({ id, slug, name }) => (
					<li key={id}>
						<NavLink to={`/app/${slug}`} onClick={close}>
							{name}
						</NavLink>
					</li>
				))}
				<li className="border-t border-base-300 pt-1">
					<Link to="/app" onClick={close}>
						{t('switcher.allWorkspaces')}
					</Link>
				</li>
			</ul>
		</details>
	);
}
