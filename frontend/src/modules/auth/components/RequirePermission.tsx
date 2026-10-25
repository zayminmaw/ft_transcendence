import type { ReactNode } from 'react';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ModulePage } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { useCan, useCurrentWorkspace } from '../hooks';

// A page your role in the open company must allow; otherwise "no access", inside the dashboard. CompanyBoundary runs
// first, so this only shows in a company you belong to: anywhere else is still "Workspace not found".
// `label` is the page's name as the sidebar shows it, e.g. 'workspace.nav.billing'.
export function RequirePermission({
	permission,
	label,
	children,
}: {
	permission: string;
	label: ParseKeys<'common'>;
	children: ReactNode;
}) {
	const { t } = useTranslation();
	const can = useCan();
	const companyPath = useCompanyPath();
	const company = useCurrentWorkspace()?.name ?? '';
	if (can(permission)) return children;
	return (
		<ModulePage
			title={t('workspace.noAccess.title')}
			description={t('workspace.noAccess.description', { area: t(label), company })}
			actions={
				<Link to={companyPath()} className="btn btn-primary">
					{t('workspace.noAccess.back')}
				</Link>
			}
		/>
	);
}
