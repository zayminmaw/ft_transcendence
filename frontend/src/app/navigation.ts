import type { TFunction } from 'i18next';
import type { NavigationGroup } from '@global-components';

// App-level composition of tenant modules. Grouping does not grant permissions;
// future session-based visibility must accompany independent route/API authorization.
// home is the company's address, /app/<companySlug>.
export function getTenantNavigation(t: TFunction, home: string): NavigationGroup[] {
	return [
		{
			label: t('workspace.nav.operations'),
			items: [
				{ to: home, label: t('workspace.nav.overview'), end: true },
				{ to: `${home}/parcels`, label: t('workspace.nav.parcels') },
				{ to: `${home}/clients`, label: t('workspace.nav.clients') },
				{ to: `${home}/drivers`, label: t('workspace.nav.drivers') },
				{ to: `${home}/assets`, label: t('workspace.nav.assets') },
			],
		},
		{
			label: t('workspace.nav.administration'),
			items: [
				{ to: `${home}/billing`, label: t('workspace.nav.billing') },
				{ to: `${home}/staff`, label: t('workspace.nav.staff') },
				{ to: `${home}/rbac`, label: t('workspace.nav.rbac') },
				{ to: `${home}/organizations`, label: t('workspace.nav.organizations') },
			],
		},
	];
}
