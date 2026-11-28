import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar } from '@global-components';
import { setActiveOrganization } from '@hooks/useActiveOrganization';
import { shownName, useCurrentWorkspace, useMe } from '../hooks';

// The card at the top of the sidebar: the open workspace and who is logged in ("Noor Haddad · Dispatcher").
// It sits at the top so a long menu never pushes the active scope and identity out of sight (#19).
export function WorkspaceScopeCard({ current, role }: { current: string; role?: string }) {
	const me = useMe().data;
	const name = me ? shownName(me.user) : '';

	return (
		<div className="flex flex-col rounded-xl bg-base-200 p-3">
			<span className="truncate text-sm font-medium">{current}</span>
			<span className="mt-2 flex min-w-0 items-center gap-2">
				{me && <Avatar name={name} seed={me.user.username} src={me.user.avatarUrl} />}
				<span className="truncate text-xs text-[var(--color-slate)]" title={me?.user.email}>
					{role ? `${name} · ${role}` : name}
				</span>
			</span>
		</div>
	);
}

// Compact workspace selector at the bottom of the sidebar.
// Navigation into /app/:companySlug or /platform/* delegates tenant cache isolation (IAM-22) to
// CompanyBoundary / RequirePlatform, while returning to /app clears activeOrganizationId directly.
export function WorkspaceSwitcher() {
	const { t } = useTranslation('auth');
	const id = useId();
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const currentWorkspace = useCurrentWorkspace();
	const me = useMe().data;

	if (!me) return null;

	const workspaces = me.workspaces;
	const destinationCount = workspaces.length + (me.platformAccess ? 1 : 0);
	if (destinationCount === 0) return null;

	const isPlatform = pathname === '/platform' || pathname.startsWith('/platform/');
	const currentValue = currentWorkspace
		? `company:${currentWorkspace.slug}`
		: isPlatform
			? 'platform'
			: '';
	const canSwitch = destinationCount > 1 || currentValue === '';
	const showAllOption = destinationCount > 1;

	function handleChange(next: string) {
		if (!next || next === currentValue) return;
		if (next === 'platform') {
			navigate('/platform/tenants');
			return;
		}
		if (next === 'all') {
			navigate('/app');
			void setActiveOrganization(null);
			return;
		}
		if (next.startsWith('company:')) {
			const slug = next.slice('company:'.length);
			navigate(`/app/${encodeURIComponent(slug)}`);
		}
	}

	return (
		<div className="relative flex items-center">
			<label htmlFor={id} className="sr-only">
				{t('switcher.change')}
			</label>
			<WorkspaceIcon />
			<select
				id={id}
				name="workspace"
				value={currentValue}
				disabled={!canSwitch}
				onChange={(event) => handleChange(event.target.value)}
				className="workspace-select select select-xs h-8 min-h-8 w-full min-w-0 rounded-field border-base-300 bg-base-200 ps-8 text-xs font-medium text-base-content transition-colors hover:border-base-content/30 disabled:cursor-default disabled:border-base-300 disabled:bg-base-200 disabled:bg-none disabled:text-base-content/75 disabled:opacity-100"
			>
				{currentValue === '' && (
					<option value="" disabled>
						{t('switcher.change')}
					</option>
				)}
				{workspaces.map(({ id: workspaceId, slug, name }) => (
					<option key={workspaceId} value={`company:${slug}`}>
						{name}
					</option>
				))}
				{me.platformAccess && <option value="platform">{t('switcher.platform')}</option>}
				{showAllOption && <option value="all">{t('switcher.allWorkspaces')}</option>}
			</select>
		</div>
	);
}

// Four-tile grid icon representing workspaces; symmetric across LTR and RTL layouts.
function WorkspaceIcon() {
	return (
		<svg
			aria-hidden="true"
			className="pointer-events-none absolute inset-s-2.5 z-10 h-3.5 w-3.5 shrink-0 text-[var(--color-slate)]"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="3" y="3" width="7" height="7" rx="1.5" />
			<rect x="14" y="3" width="7" height="7" rx="1.5" />
			<rect x="3" y="14" width="7" height="7" rx="1.5" />
			<rect x="14" y="14" width="7" height="7" rx="1.5" />
		</svg>
	);
}
