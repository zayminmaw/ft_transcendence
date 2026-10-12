import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

const navigation = [
	{ to: '/product', label: 'Product' },
	{ to: '/solutions', label: 'Solutions' },
	{ to: '/contact', label: 'Plan your rollout' },
];
const titles: Record<string, string> = {
	'/': 'Transcend — From first pickup to final payout',
	'/product': 'Product — Transcend',
	'/solutions': 'Solutions — Transcend',
	'/contact': 'Plan your rollout — Transcend',
};

export function MarketingLayout() {
	const { pathname } = useLocation();
	useEffect(() => {
		document.title = titles[pathname] ?? 'Page not found — Transcend';
		window.scrollTo({ top: 0, behavior: 'instant' });
	}, [pathname]);

	return (
		<div className="min-h-screen bg-base-100 text-base-content">
			<a
				href="#main-content"
				className="btn btn-neutral fixed left-4 top-4 z-50 -translate-y-24 focus:translate-y-0"
			>
				Skip to content
			</a>
			<div className="bg-accent px-4 py-2 text-center text-xs text-accent-content">
				Introducing Transcend · A workspace blueprint for accounting and delivery
			</div>
			<header className="border-b border-base-300">
				<div className="navbar mx-auto max-w-7xl flex-wrap gap-4 px-6 py-5 md:px-10">
					<Link
						to="/"
						aria-label="Transcend home"
						className="mr-auto flex items-center gap-3 text-xl font-bold tracking-tight"
					>
						<span
							aria-hidden="true"
							className="grid size-9 place-items-center rounded-lg bg-primary text-primary-content"
						>
							↗
						</span>
						{' transcend'}
					</Link>
					<nav
						aria-label="Website navigation"
						className="order-3 flex w-full flex-wrap gap-1 md:order-none md:w-auto"
					>
						{navigation.map(({ to, label }) => (
							<NavLink
								key={to}
								to={to}
								className={({ isActive }) =>
									`btn btn-ghost btn-sm ${isActive ? 'bg-base-300' : ''}`
								}
							>
								{label}
							</NavLink>
						))}
					</nav>
					<Link to="/app" className="btn btn-neutral btn-sm">
						Workspace preview <span aria-hidden="true">↗</span>
					</Link>
				</div>
			</header>
			<main id="main-content">
				<Outlet />
			</main>
			<footer className="border-t border-base-300">
				<div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-6 py-10 text-sm md:flex-row md:px-10">
					<div>
						<Link to="/" className="font-bold">
							transcend
						</Link>
						<p className="mt-2 opacity-65">
							A connected workspace for last-mile logistics.
						</p>
					</div>
					<nav
						aria-label="Footer navigation"
						className="flex flex-wrap items-start gap-6"
					>
						{navigation.map(({ to, label }) => (
							<Link key={to} to={to} className="link link-hover">
								{label}
							</Link>
						))}
					</nav>
				</div>
			</footer>
		</div>
	);
}
