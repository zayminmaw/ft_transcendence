import type { TFunction } from 'i18next';
import type { NavigationGroup } from '@global-components';

// App-level composition of tenant modules. Grouping does not grant permissions;
// future session-based visibility must accompany independent route/API authorization.
export function getTenantNavigation(t: TFunction): NavigationGroup[] {
	return [
		{
			label: t('workspace.nav.operations'),
			items: [
				{ to: '/app', label: t('workspace.nav.overview'), end: true },
				{ to: '/app/parcels', label: t('workspace.nav.parcels') },
				{ to: '/app/clients', label: t('workspace.nav.clients') },
				{ to: '/app/drivers', label: t('workspace.nav.drivers') },
				{ to: '/app/assets', label: t('workspace.nav.assets') },
			],
		},
		{
			label: t('workspace.nav.administration'),
			items: [
				{ to: '/app/billing', label: t('workspace.nav.billing') },
				{ to: '/app/staff', label: t('workspace.nav.staff') },
				{ to: '/app/rbac', label: t('workspace.nav.rbac') },
				{ to: '/app/organizations', label: t('workspace.nav.organizations') },
			],
		},
	];
}
