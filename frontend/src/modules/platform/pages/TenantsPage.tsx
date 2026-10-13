import { Link } from 'react-router-dom';
import { AnalyticsCard } from '@global-components';
import type { AnalyticsItem } from '@global-components';

// Sample data until the tenant endpoints exist.
const tenantStats: AnalyticsItem[] = [
	{ label: 'Total tenants', value: 24, description: 'Organization records' },
	{ label: 'Active', value: 21, description: 'Portal access enabled' },
	{ label: 'Suspended', value: 3, description: 'History retained' },
	{ label: 'Admin changes', value: 6, description: 'In the last 7 days' },
];

export function TenantsPage() {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h1
						id="workspace-page-title"
						className="workspace-title text-[2rem] md:text-[2.5rem]"
					>
						Tenant administration
					</h1>
					<p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--color-slate)]">
						Organization access, tenant ownership, and management activity.
					</p>
				</div>
				<Link
					to="/platform/tenants/new"
					className="btn btn-primary w-full md:w-auto md:px-12"
				>
					Create tenant
				</Link>
			</div>
			<AnalyticsCard items={tenantStats} />
		</div>
	);
}
