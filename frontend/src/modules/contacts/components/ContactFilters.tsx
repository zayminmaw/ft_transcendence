import { useTranslation } from 'react-i18next';
import { TableToolbar } from '@global-components';
import { useRoleName } from '@modules/auth';
import type { Contact } from '../api';

// The search box and role filter shared by the contacts list and the add page.
export function ContactFilters({
	search,
	onSearchChange,
	roleCode,
	onRoleChange,
	roles,
}: {
	search: string;
	onSearchChange: (value: string) => void;
	roleCode: string;
	onRoleChange: (value: string) => void;
	roles: Contact['role'][];
}) {
	const { t } = useTranslation('contacts');
	const roleName = useRoleName();

	return (
		<TableToolbar
			search={{ value: search, onChange: onSearchChange, placeholder: t('filters.search') }}
			filter={{
				label: t('filters.role'),
				value: roleCode,
				onChange: onRoleChange,
				options: [
					{ value: 'all', label: t('filters.allRoles') },
					...roles.map((role) => ({ value: role.code, label: roleName(role) })),
				],
			}}
		/>
	);
}
