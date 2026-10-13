import { NavLink } from 'react-router-dom';
import type { BreadcrumbLink } from './types';

type BreadcrumbsProps = {
	links: BreadcrumbLink[];
};

const Breadcrumbs = ({ links }: BreadcrumbsProps) => {
	return (
		<div className="breadcrumbs text-sm">
			<ul>
				{links.map((link) => (
					<li key={link.href}>
						{link.status === 'active' ? (
							<NavLink to={link.href}>{link.label}</NavLink>
						) : (
							<span className="hover:no-underlinecursor-default">{link.label}</span>
						)}
					</li>
				))}
			</ul>
		</div>
	);
};

export default Breadcrumbs;
