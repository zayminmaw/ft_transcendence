import type { TFunction } from 'i18next';
import type { NavigationGroup } from '@global-components';

// What each module's sidebar link and pages need in the open company (ERP outline section 5). Hiding a link is not
// authorization: the API checks every request.
export const MODULE_ACCESS = {
	parcels: { permission: 'parcels.view', label: 'workspace.nav.parcels' },
	clients: { permission: 'clients.view', label: 'workspace.nav.clients' },
	drivers: { permission: 'drivers.view', label: 'workspace.nav.drivers' },
	assets: { permission: 'assets.view', label: 'workspace.nav.assets' },
	rbac: { permission: 'admin.manage_users', label: 'workspace.nav.rbac' },
	// Every company role holds it: your own contacts, not other people's.
	contacts: { permission: 'contacts.manage_own', label: 'workspace.nav.contacts' },
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
				...links(['parcels', 'clients', 'drivers', 'assets', 'contacts']),
			],
		},
		{
			label: t('workspace.nav.administration'),
			items: [
				...links(['rbac']),
				// Not in MODULE_ACCESS: its label lives in the audit namespace, and the page shows its own "no access".
				{
					to: `${home}/audit`,
					label: t('nav', { ns: 'audit' }),
					hidden: !can('admin.audit_logs'),
				},
				{
					to: `${home}/activity`,
					label: t('nav', { ns: 'insights' }),
					hidden: !can('admin.audit_logs'),
				},
			],
		},
	];
}
