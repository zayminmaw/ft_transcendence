import Breadcrumbs from '../Breadcrumbs/Breadcrumbs';
import type { BreadcrumbLink } from '../Breadcrumbs/types';

type MainLayoutProps = {
	children?: React.ReactNode;
	links: BreadcrumbLink[];
};

export function MainLayout({ children, links }: MainLayoutProps) {
	return (
		<div className="p-5">
			<div className="flex items-center">
				<Breadcrumbs links={links} />
			</div>
			<div className="divider my-3"></div>
			{children}
		</div>
	);
}
