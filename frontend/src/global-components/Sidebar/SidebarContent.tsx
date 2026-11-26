import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';

export type NavigationGroup = {
	label?: string;
	// hidden: left out of the sidebar (e.g. the role doesn't allow it) but still names the page in the breadcrumb.
	// A group with nothing to show disappears.
	items: { to: string; label: string; end?: boolean; hidden?: boolean }[];
};

export type SidebarContentProps = {
	scope: string;
	homeTo: string;
	groups: NavigationGroup[];
	onNavigate?: () => void;
	// Replaces the scope card at the top, e.g. with the active workspace and account card.
	header?: ReactNode;
	// Compact workspace selector placed at the bottom of the sidebar above footer actions.
	workspaceSelector?: ReactNode;
	// Shown under the workspace selector, e.g. profile and log out.
	footer?: ReactNode;
};

export function SidebarContent({
	scope,
	homeTo,
	groups,
	onNavigate,
	header,
	workspaceSelector,
	footer,
}: SidebarContentProps) {
	const { t } = useTranslation();

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-5">
			<Link
				to={homeTo}
				onClick={onNavigate}
				className="workspace-title w-fit shrink-0 text-[2rem]"
				aria-label={t('sidebar.home', { scope })}
			>
				transcend
			</Link>
			<div className="shrink-0">
				{header ?? (
					<div className="rounded-xl bg-base-200 p-3">
						<p className="text-sm font-medium">{scope}</p>
						<p className="mt-1 text-xs text-[var(--color-slate)]">
							{t('layout.preview')}
						</p>
					</div>
				)}
			</div>
			<nav
				aria-label={t('layout.navigation', { scope })}
				className="-mx-2 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-2"
			>
				{groups.map(({ label, items }, index) => {
					const shown = items.filter((item) => !item.hidden);
					if (shown.length === 0) return null;
					return (
						<div key={label ?? index} role="group" aria-label={label}>
							{label && (
								<p
									className={`mb-2.5 text-xs text-[var(--color-slate)] ${index > 0 ? 'border-t border-base-300 pt-5' : ''}`}
								>
									{label}
								</p>
							)}
							<ul className="menu w-full gap-1 p-0">
								{shown.map(({ to, label, end }) => (
									<li key={to}>
										<NavLink
											to={to}
											end={end}
											onClick={onNavigate}
											className={({ isActive }) =>
												`min-h-10 rounded-xl px-3 py-2 text-sm font-medium ${isActive ? 'bg-base-200 text-base-content' : 'text-[var(--color-slate)] hover:bg-base-200 hover:text-base-content'}`
											}
										>
											{label}
										</NavLink>
									</li>
								))}
							</ul>
						</div>
					);
				})}
			</nav>
			{(workspaceSelector || footer) && (
				<div className="flex shrink-0 flex-col gap-3 border-t border-base-300 pt-4">
					{workspaceSelector}
					{footer}
				</div>
			)}
		</div>
	);
}
