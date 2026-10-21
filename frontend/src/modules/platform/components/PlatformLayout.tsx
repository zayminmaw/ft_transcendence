import { DashboardLayout } from '@global-components';
import type { NavigationGroup } from '@global-components';
import { AccountFooter, WorkspaceSwitcher } from '@modules/auth';

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
			header={<WorkspaceSwitcher current="Platform administration" />}
			footer={<AccountFooter />}
		/>
	);
}
