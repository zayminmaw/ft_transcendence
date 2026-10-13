import { NavLink } from 'react-router-dom';
import type { BreadcrumbLink } from './types';

type BreadcrumbsProps = {
	links: BreadcrumbLink[];
};

const Breadcrumbs = ({ links }: BreadcrumbsProps) => {
	return (
		<nav aria-label="Breadcrumb" className="min-w-0 flex-1 text-sm text-[var(--color-slate)]">
			<ul className="flex items-center">
				{links.map((link, index) => (
					<li
						key={`${link.href}:${link.label}`}
						className={index > 0 ? 'hidden sm:flex' : 'flex'}
					>
						{index > 0 && (
							<span aria-hidden="true" className="mx-2">
								/
							</span>
						)}
						{link.status === 'active' ? (
							<NavLink to={link.href}>{link.label}</NavLink>
						) : (
							<span className="cursor-default">{link.label}</span>
						)}
					</li>
				))}
			</ul>
		</nav>
	);
};

export default Breadcrumbs;
