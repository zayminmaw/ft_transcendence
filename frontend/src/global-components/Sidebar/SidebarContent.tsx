import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';

export type NavigationGroup = {
	label?: string;
	items: { to: string; label: string; end?: boolean }[];
};

export type SidebarContentProps = {
	scope: string;
	homeTo: string;
	groups: NavigationGroup[];
	onNavigate?: () => void;
	// Replaces the scope card at the top, e.g. with the workspace switcher.
	header?: ReactNode;
	// Shown under "Back to website", e.g. Log out.
	footer?: ReactNode;
};

export function SidebarContent({
	scope,
	homeTo,
	groups,
	onNavigate,
	header,
	footer,
}: SidebarContentProps) {
	const { t } = useTranslation();

	return (
		<div className="flex min-h-full flex-col gap-6">
			<Link
				to={homeTo}
				onClick={onNavigate}
				className="workspace-title w-fit text-[2rem]"
				aria-label={t('sidebar.home', { scope })}
			>
				transcend
			</Link>
			{header ?? (
				<div className="rounded-xl bg-base-200 p-3">
					<p className="text-sm font-medium">{scope}</p>
					<p className="mt-1 text-xs text-[var(--color-slate)]">{t('layout.preview')}</p>
				</div>
			)}
			<nav aria-label={t('layout.navigation', { scope })} className="flex flex-col gap-6">
				{groups.map(({ label, items }, index) => (
					<div key={label ?? index} role="group" aria-label={label}>
						{label && (
							<p
								className={`mb-3 text-xs text-[var(--color-slate)] ${index > 0 ? 'border-t border-base-300 pt-6' : ''}`}
							>
								{label}
							</p>
						)}
						<ul className="menu w-full gap-1 p-0">
							{items.map(({ to, label, end }) => (
								<li key={to}>
									<NavLink
										to={to}
										end={end}
										onClick={onNavigate}
										className={({ isActive }) =>
											`min-h-11 rounded-xl px-3 py-3 text-sm font-medium ${isActive ? 'bg-base-200 text-base-content' : 'text-[var(--color-slate)] hover:bg-base-200 hover:text-base-content'}`
										}
									>
										{label}
									</NavLink>
								</li>
							))}
						</ul>
					</div>
				))}
			</nav>
			<div className="mt-auto flex flex-col gap-4">
				<Link to="/" onClick={onNavigate} className="btn btn-ghost bg-base-200">
					{t('sidebar.backToWebsite')}
				</Link>
				{footer}
			</div>
		</div>
	);
}
