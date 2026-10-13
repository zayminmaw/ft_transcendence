import { MainLayout } from '@components';
import type { BreadcrumbLink } from 'src/components/Breadcrumbs/types';

const TenantsList = () => {
	const links: BreadcrumbLink[] = [
		{ label: 'Platform', href: '/', status: 'inactive' },
		{ label: 'Organizations', href: '/organizations', status: 'active' },
	];

	return <MainLayout links={links}>Hello World</MainLayout>;
};

export default TenantsList;
