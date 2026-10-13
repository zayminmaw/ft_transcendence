import type { NavigationGroup } from '@global-components';

// App-level composition of tenant modules. Grouping does not grant permissions;
// future session-based visibility must accompany independent route/API authorization.
export const tenantNavigation: NavigationGroup[] = [
	{
		label: 'Operations',
		items: [
			{ to: '/app', label: 'Overview', end: true },
			{ to: '/app/parcels', label: 'Dispatch & parcels' },
			{ to: '/app/clients', label: 'Clients / merchants' },
			{ to: '/app/drivers', label: 'Drivers' },
			{ to: '/app/assets', label: 'Fleet & assets' },
		],
	},
	{
		label: 'Administration',
		items: [
			{ to: '/app/billing', label: 'Billing & COD' },
			{ to: '/app/staff', label: 'Staff' },
			{ to: '/app/rbac', label: 'Access control' },
			{ to: '/app/organizations', label: 'Organization settings' },
		],
	},
];
