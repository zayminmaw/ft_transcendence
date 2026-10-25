import type { TFunction } from 'i18next';
import type { NavigationGroup } from '@global-components';

// What each module's sidebar link and pages need in the open company (ERP outline section 5). Organization settings
// has no permission of its own yet: admin.manage_roles keeps it to company admins until the organization system
// defines one. Hiding a link is not authorization: the API checks every request.
export const MODULE_ACCESS = {
	parcels: { permission: 'parcels.view', label: 'workspace.nav.parcels' },
	clients: { permission: 'clients.view', label: 'workspace.nav.clients' },
	drivers: { permission: 'drivers.view', label: 'workspace.nav.drivers' },
	assets: { permission: 'assets.view', label: 'workspace.nav.assets' },
	billing: { permission: 'billing.view', label: 'workspace.nav.billing' },
	staff: { permission: 'staff.view', label: 'workspace.nav.staff' },
	rbac: { permission: 'admin.manage_users', label: 'workspace.nav.rbac' },
	organizations: { permission: 'admin.manage_roles', label: 'workspace.nav.organizations' },
} as const;
type Module = keyof typeof MODULE_ACCESS;

// App-level composition of tenant modules. A link your role doesn't allow is hidden (the sidebar leaves it out, and a
// group left empty disappears) but still names its page in the breadcrumb, e.g. on the "no access" page.
// home is the company's address, /app/<companySlug>.
export function getTenantNavigation(
	t: TFunction,
	home: string,
	can: (permission: string) => boolean,
): NavigationGroup[] {
	const links = (modules: Module[]) =>
		modules.map((module) => ({
			to: `${home}/${module}`,
			label: t(MODULE_ACCESS[module].label),
			hidden: !can(MODULE_ACCESS[module].permission),
		}));
	return [
		{
			label: t('workspace.nav.operations'),
			items: [
				{ to: home, label: t('workspace.nav.overview'), end: true },
				...links(['parcels', 'clients', 'drivers', 'assets']),
			],
		},
		{
			label: t('workspace.nav.administration'),
			items: links(['billing', 'staff', 'rbac', 'organizations']),
		},
	];
}
