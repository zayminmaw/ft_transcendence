import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useMe } from '../hooks';

// The open company (NavLink's aria-current) is marked light grey like the sidebar's current page, instead of
// daisyUI's dark default.
const MENU_COLORS =
	'[--menu-active-bg:var(--color-base-200)] [--menu-active-fg:var(--color-base-content)]';

// The card at the top of the sidebar: the open workspace, who is logged in and as what ("noor · Dispatcher"), and a
// menu to move to another workspace. It sits at the top so a long menu never pushes the name out of sight (#19).
export function WorkspaceSwitcher({ current, role }: { current: string; role?: string }) {
	const { t } = useTranslation('auth');
	const { pathname } = useLocation();
	const me = useMe().data;
	const workspaces = me?.workspaces ?? [];
	const username = me?.user.username ?? '';
	const who = (
		<span className="mt-1 truncate text-xs text-[var(--color-slate)]" title={me?.user.email}>
			{role ? `${username} · ${role}` : username}
		</span>
	);
	// One company and no platform access: the picker would only open it again, so there is no menu.
	const nowhereElse = workspaces.length === 1 && !me?.platformAccess;
	const menu = useRef<HTMLDetailsElement>(null);
	const close = () => menu.current?.removeAttribute('open');

	// Close like other menus: on a click outside it, on Escape (focus goes back to the card) and when the page changes.
	useEffect(() => {
		const onPointerDown = (event: PointerEvent) => {
			if (!menu.current?.contains(event.target as Node))
				menu.current?.removeAttribute('open');
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || !menu.current?.open) return;
			menu.current.removeAttribute('open');
			menu.current.querySelector('summary')?.focus();
		};
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, []);

	useEffect(() => {
		menu.current?.removeAttribute('open');
	}, [pathname]);

	if (nowhereElse)
		return (
			<div className="flex flex-col rounded-xl bg-base-200 p-3">
				<span className="text-sm font-medium">{current}</span>
				{who}
			</div>
		);

	return (
		<details ref={menu} className="group dropdown w-full">
			<summary className="flex cursor-pointer list-none flex-col rounded-xl bg-base-200 p-3 [&::-webkit-details-marker]:hidden">
				<span className="flex items-center justify-between gap-2 text-sm font-medium">
					{current}
					<ChevronIcon />
				</span>
				{who}
				<span className="sr-only">{t('switcher.change')}</span>
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

// Points down while the menu is closed, up while it is open.
function ChevronIcon() {
	return (
		<svg
			aria-hidden="true"
			className="h-[1em] shrink-0 transition-transform group-open:rotate-180"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	);
}
