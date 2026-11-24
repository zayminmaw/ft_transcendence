import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LanguageSwitcher } from '@global-components';

const navigation = [
	{ to: '/product', label: 'layout.nav.product' },
	{ to: '/solutions', label: 'layout.nav.solutions' },
	{ to: '/contact', label: 'layout.nav.contact' },
	{ to: '/track', label: 'layout.nav.track' },
] as const;
const legalLinks = [
	{ to: '/privacy', label: 'layout.legal.privacy' },
	{ to: '/terms', label: 'layout.legal.terms' },
] as const;
const pageNames: Record<string, (typeof navigation | typeof legalLinks)[number]['label']> = {
	'/product': 'layout.nav.product',
	'/solutions': 'layout.nav.solutions',
	'/contact': 'layout.nav.contact',
	'/privacy': 'layout.legal.privacy',
	'/terms': 'layout.legal.terms',
};

export function MarketingLayout() {
	const { t, i18n } = useTranslation('marketing');
	const { pathname } = useLocation();
	useEffect(() => {
		// Other pages in this layout, such as the tracking and not-found pages, set their own title.
		if (pathname === '/') document.title = t('layout.titles.home');
		else if (pageNames[pathname])
			document.title = t('layout.titles.page', { page: t(pageNames[pathname]) });
	}, [pathname, t, i18n.resolvedLanguage]);
	useEffect(() => {
		window.scrollTo({ top: 0, behavior: 'instant' });
	}, [pathname]);

	return (
		<div className="flex min-h-screen flex-col bg-base-100 text-base-content">
			<a
				href="#main-content"
				className="btn btn-neutral fixed inset-s-4 top-4 z-50 -translate-y-24 focus:translate-y-0"
			>
				{t('layout.skipToContent')}
			</a>
			<div className="bg-accent px-4 py-2 text-center text-xs text-accent-content">
				{t('layout.banner')}
			</div>
			<header className="border-b border-base-300">
				<div className="navbar mx-auto max-w-7xl flex-wrap gap-4 px-6 py-5 md:px-10">
					<Link
						to="/"
						aria-label={t('layout.home')}
						className="me-auto flex items-center gap-3 text-xl font-bold tracking-tight"
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
						aria-label={t('layout.websiteNavigation')}
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
								{t(label)}
							</NavLink>
						))}
					</nav>
					<LanguageSwitcher />
					<Link to="/app" className="btn btn-neutral btn-sm">
						{t('layout.workspacePreview')}{' '}
						<span aria-hidden="true" className="inline-block rtl:-scale-x-100">
							↗
						</span>
					</Link>
				</div>
			</header>
			{/* Grows on short pages (tracking, not found), so the footer stays at the bottom of the screen. */}
			<main id="main-content" className="flex-1">
				<Outlet />
			</main>
			<footer className="border-t border-base-300">
				<div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-6 py-10 text-sm md:flex-row md:items-center md:px-10">
					<div>
						<Link to="/" className="font-bold">
							transcend
						</Link>
						<p className="mt-2 opacity-65">{t('layout.tagline')}</p>
					</div>
					<div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
						<nav
							aria-label={t('layout.footerNavigation')}
							className="flex flex-wrap items-start gap-6"
						>
							{navigation.map(({ to, label }) => (
								<Link key={to} to={to} className="link link-hover">
									{t(label)}
								</Link>
							))}
						</nav>
						<nav
							aria-label={t('layout.legalNavigation')}
							className="flex flex-wrap items-start gap-6 opacity-75"
						>
							{legalLinks.map(({ to, label }) => (
								<Link key={to} to={to} className="link link-hover">
									{t(label)}
								</Link>
							))}
						</nav>
					</div>
				</div>
			</footer>
		</div>
	);
}
