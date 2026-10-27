import { Fragment } from 'react';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useRoleName } from '@modules/auth';
import { formatNumber } from '@utils/format';
import type { RoleOverview } from '../api';
import { memberErrorKey } from '../errors';
import { useRoleOverview } from '../hooks';

// One card per company role, in the style of the page's tiles: how many people here have it, and what it allows,
// grouped by module in plain words. Read-only: roles are the same in every company.
export function RolesOverview() {
	const { t, i18n } = useTranslation('rbac');
	const roleName = useRoleName();
	const roles = useRoleOverview();
	// A code without a translation (a permission added later) shows as it is.
	const label = (code: string) =>
		i18n.exists(`rbac:permissions.${code}`)
			? t(`permissions.${code}` as ParseKeys<'rbac'>)
			: code;

	if (roles.isPending)
		return <span className="loading loading-spinner" aria-label={t('page.loading')} />;
	if (roles.isError)
		return (
			<p role="alert" className="alert alert-error alert-soft text-sm">
				{t(memberErrorKey(roles.error))}
			</p>
		);
	return (
		<ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
			{roles.data.map((role) => (
				<li key={role.code} className="rounded-box bg-base-200 p-6">
					<h3 className="font-semibold">{roleName(role)}</h3>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{t('roles.holders', { n: formatNumber(role.members, i18n.language) })}
					</p>
					{role.permissions.length === 0 ? (
						<p className="mt-4 text-sm text-[var(--color-slate)]">{t('roles.none')}</p>
					) : (
						<dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
							{byModule(role.permissions).map(([module, permissions]) => (
								<Fragment key={module}>
									<dt className="text-[var(--color-slate)]">
										{i18n.exists(`rbac:modules.${module}`)
											? t(`modules.${module}` as ParseKeys<'rbac'>)
											: module}
									</dt>
									<dd>
										{permissions
											.map(({ code, scope }) =>
												scope === 'all'
													? label(code)
													: t('roles.ownOnly', { action: label(code) }),
											)
											.join(', ')}
									</dd>
								</Fragment>
							))}
						</dl>
					)}
				</li>
			))}
		</ul>
	);
}

// "parcels.view" belongs to "parcels"; modules keep the order the permissions come in (the docs' order).
function byModule(permissions: RoleOverview['permissions']) {
	const groups = new Map<string, RoleOverview['permissions']>();
	for (const permission of permissions) {
		const module = permission.code.split('.')[0];
		groups.set(module, [...(groups.get(module) ?? []), permission]);
	}
	return [...groups];
}
