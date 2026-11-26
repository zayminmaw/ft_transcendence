import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@global-components';
import type { NavigationGroup } from '@global-components';
import { AccountFooter } from './AccountFooter';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

// Fallback shell for direct /profile visits outside a company or platform workspace, so the profile page always renders
// inside the standard DashboardLayout with sidebar, top bar, breadcrumbs and language switcher.
export function AccountLayout() {
	const { t } = useTranslation('auth');
	const groups: NavigationGroup[] = [
		{
			items: [
				{ to: '/app', label: t('switcher.allWorkspaces'), end: true },
				{ to: '/profile', label: t('account.profile'), end: true },
			],
		},
	];
	return (
		<DashboardLayout
			scope={t('account.profile')}
			homeTo="/app"
			groups={groups}
			header={<WorkspaceSwitcher current={t('account.profile')} />}
			footer={<AccountFooter profileTo="/profile" />}
		/>
	);
}

