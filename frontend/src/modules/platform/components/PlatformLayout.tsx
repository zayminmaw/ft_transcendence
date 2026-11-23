import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@global-components';
import type { NavigationGroup } from '@global-components';
import { AccountFooter, WorkspaceSwitcher } from '@modules/auth';

export function PlatformLayout() {
	const { t } = useTranslation('auth');
	const { t: tp } = useTranslation('platform');
	const navigation: NavigationGroup[] = [
		{
			items: [
				{ to: '/platform/tenants', label: tp('tenants.heading') },
				{ to: '/platform/activity', label: tp('activity.title') },
			],
		},
	];
	return (
		<DashboardLayout
			scope={tp('layout.scope')}
			homeTo="/platform/tenants"
			groups={navigation}
			header={
				<WorkspaceSwitcher current={tp('layout.scope')} role={t('switcher.platformRole')} />
			}
			footer={<AccountFooter />}
		/>
	);
}
