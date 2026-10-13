import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Breadcrumbs from '../Breadcrumbs/Breadcrumbs';
import type { BreadcrumbLink } from '../Breadcrumbs/types';
import { SidebarContent } from '../Sidebar/SidebarContent';
import type { SidebarContentProps } from '../Sidebar/SidebarContent';

export function DashboardLayout(props: Omit<SidebarContentProps, 'onNavigate'>) {
	const { pathname } = useLocation();
	const navigation = useRef<HTMLDialogElement>(null);
	const main = useRef<HTMLElement>(null);
	const currentPage = props.groups
		.flatMap((group) => group.items)
		.find(({ to, end }) => pathname === to || (!end && pathname.startsWith(`${to}/`)));
	const links: BreadcrumbLink[] = [
		{ label: props.scope, href: props.homeTo, status: 'inactive' },
		{
			label: currentPage?.label ?? 'Page not found',
			href: currentPage?.to ?? pathname,
			status: 'active',
		},
	];

	useEffect(() => {
		navigation.current?.close();
		main.current?.focus({ preventScroll: true });
		window.scrollTo({ top: 0, behavior: 'instant' });
	}, [pathname]);

	useEffect(() => {
		const desktop = window.matchMedia('(min-width: 48rem)');
		const closeOnDesktop = () => {
			if (desktop.matches) navigation.current?.close();
		};
		desktop.addEventListener('change', closeOnDesktop);
		return () => desktop.removeEventListener('change', closeOnDesktop);
	}, []);

	return (
		<div className="min-h-dvh bg-base-100 text-base-content md:grid md:grid-cols-[240px_minmax(0,1fr)]">
			<a
				href="#workspace-content"
				className="btn btn-neutral fixed left-4 top-4 z-50 -translate-y-24 focus:translate-y-0"
			>
				Skip to content
			</a>
			<aside className="sticky top-0 hidden h-dvh overflow-y-auto p-6 md:block">
				<SidebarContent {...props} />
			</aside>
			<div className="min-w-0">
				<header className="navbar min-h-[76px] gap-4 border-b border-base-300 px-6 md:px-8">
					<button
						type="button"
						className="btn btn-ghost btn-sm md:hidden"
						aria-label="Open navigation"
						aria-haspopup="dialog"
						aria-controls="workspace-navigation"
						onClick={() => navigation.current?.showModal()}
					>
						Menu
					</button>
					<Breadcrumbs links={links} />
					<span className="badge shrink-0 border-0 bg-base-200 px-3 py-3 text-xs">
						Layout preview
					</span>
				</header>
				<main
					id="workspace-content"
					ref={main}
					tabIndex={-1}
					className="min-h-[calc(100dvh-76px)] p-6 outline-none md:p-8"
				>
					<Outlet />
				</main>
			</div>
			<dialog
				id="workspace-navigation"
				ref={navigation}
				className="modal justify-start md:hidden"
				aria-label={`${props.scope} navigation`}
			>
				<div className="modal-box flex h-dvh max-h-none w-72 max-w-[calc(100vw-2rem)] flex-col gap-4 rounded-none bg-base-100 p-6">
					<form method="dialog" className="flex justify-end">
						<button className="btn btn-ghost btn-sm">Close navigation</button>
					</form>
					<SidebarContent {...props} onNavigate={() => navigation.current?.close()} />
				</div>
				<form method="dialog" className="modal-backdrop">
					<button aria-label="Close navigation">Close</button>
				</form>
			</dialog>
		</div>
	);
}
