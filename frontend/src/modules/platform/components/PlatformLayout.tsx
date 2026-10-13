import { DashboardLayout } from '@global-components';
import type { NavigationGroup } from '@global-components';

const navigation: NavigationGroup[] = [
	{
		items: [
			{ to: '/platform/tenants', label: 'Tenants' },
			{ to: '/platform/activity', label: 'Tenant activity' },
		],
	},
];

export function PlatformLayout() {
	return (
		<DashboardLayout
			scope="Platform administration"
			homeTo="/platform/tenants"
			groups={navigation}
		/>
	);
}
