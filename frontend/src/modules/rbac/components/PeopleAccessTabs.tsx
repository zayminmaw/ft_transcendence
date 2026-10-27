import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { useCan } from '@modules/auth';
import { formatNumber } from '@utils/format';

// The Figma's tabs under the page header: Members · n, and Roles & permissions for those who may see the roles.
// Each tab is its own address, so it can be linked.
export function PeopleAccessTabs({ members }: { members: number }) {
	const { t, i18n } = useTranslation('rbac');
	const companyPath = useCompanyPath();
	const can = useCan();
	const tabClass = ({ isActive }: { isActive: boolean }) =>
		`btn rounded-xl ${isActive ? 'btn-neutral' : 'btn-ghost bg-base-200'}`;
	return (
		<nav aria-label={t('tabs.label')} className="flex flex-wrap gap-2">
			<NavLink to={companyPath('rbac')} end className={tabClass}>
				{t('tabs.members', { n: formatNumber(members, i18n.language) })}
			</NavLink>
			{can('admin.manage_roles') && (
				<NavLink to={companyPath('rbac/roles')} className={tabClass}>
					{t('tabs.roles')}
				</NavLink>
			)}
		</nav>
	);
}
