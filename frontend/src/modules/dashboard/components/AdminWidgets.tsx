import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { shownName, useRoleName } from '@modules/auth';
import { formatDate, formatNumber } from '@utils/format';
import type { DashboardContact, DashboardInsights, DashboardInvite, DashboardMember } from '../api';
import { WidgetFrame } from './WidgetFrame';

type TeamAccessWidgetProps = {
	members: DashboardMember[] | undefined;
	invites: DashboardInvite[] | undefined;
	isPending: boolean;
	isError: boolean;
	onRetry: () => void;
	canManageRoles: boolean;
	className?: string;
};

export function TeamAccessWidget({
	members,
	invites,
	isPending,
	isError,
	onRetry,
	canManageRoles,
	className = '',
}: TeamAccessWidgetProps) {
	const { t, i18n } = useTranslation('dashboard');
	const companyPath = useCompanyPath();
	const roleName = useRoleName();
	const number = (value: number) => formatNumber(value, i18n.language);

	const allMembers = members ?? [];
	const activeCount = allMembers.filter((m) => m.isActive).length;
	const inactiveCount = allMembers.length - activeCount;
	const mustChangeCount = allMembers.filter((m) => m.isActive && m.mustChangePassword).length;
	const pendingInvites = (invites ?? []).filter((inv) => inv.status === 'pending').length;
	const recentMembers = allMembers.slice(0, 5);

	return (
		<WidgetFrame
			title={t('team.title')}
			subtitle={t('team.subtitle')}
			actionTo={companyPath('rbac')}
			actionLabel={t('actions.manage')}
			actionContext={t('team.title')}
			badge={
				pendingInvites > 0 ? (
					<span className="badge badge-info badge-soft badge-sm tabular-nums">
						{t('team.pendingInvitesBadge', {
							count: pendingInvites,
							formatted: number(pendingInvites),
						})}
					</span>
				) : undefined
			}
			isPending={isPending}
			isError={isError}
			onRetry={onRetry}
			className={className}
		>
			<dl className="mb-4 grid grid-cols-2 gap-3 rounded-box bg-base-200 p-4 @sm:grid-cols-4">
				<div>
					<dt className="text-xs text-[var(--color-slate)]">{t('team.stats.active')}</dt>
					<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
						{number(activeCount)}
					</dd>
				</div>
				<div>
					<dt className="text-xs text-[var(--color-slate)]">
						{t('team.stats.inactive')}
					</dt>
					<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
						{number(inactiveCount)}
					</dd>
				</div>
				<div>
					<dt className="text-xs text-[var(--color-slate)]">
						{t('team.stats.pendingInvites')}
					</dt>
					<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
						{number(pendingInvites)}
					</dd>
				</div>
				<div>
					<dt className="text-xs text-[var(--color-slate)]">
						{t('team.stats.passwordPending')}
					</dt>
					<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
						{number(mustChangeCount)}
					</dd>
				</div>
			</dl>

			{recentMembers.length === 0 ? (
				<p className="rounded-box bg-base-200 px-4 py-6 text-center text-xs text-[var(--color-slate)]">
					{t('team.empty')}
				</p>
			) : (
				<ul className="divide-y divide-base-300">
					{recentMembers.map((member) => {
						const name = shownName(member);
						return (
							<li
								key={member.userId}
								className="flex items-center justify-between gap-3 py-3"
							>
								<div className="min-w-0">
									<p className="truncate text-sm font-medium text-base-content">
										<bdi>{name}</bdi>
									</p>
									<p className="truncate text-xs text-[var(--color-slate)]">
										<span dir="ltr">{member.username}</span>
										{!member.isActive ? ` · ${t('team.inactiveLabel')}` : ''}
									</p>
								</div>
								<span className="badge badge-ghost badge-sm shrink-0">
									{roleName(member.role)}
								</span>
							</li>
						);
					})}
				</ul>
			)}

			<footer className="mt-4 flex flex-wrap gap-2 border-t border-base-300 pt-4">
				<Link to={companyPath('rbac/invites')} className="btn btn-sm border-0 bg-base-200">
					{t('team.invitesLink')}
				</Link>
				{canManageRoles && (
					<Link
						to={companyPath('rbac/roles')}
						className="btn btn-sm border-0 bg-base-200"
					>
						{t('team.rolesLink')}
					</Link>
				)}
			</footer>
		</WidgetFrame>
	);
}

type ActivityInsightsWidgetProps = {
	insights: DashboardInsights | undefined;
	isPending: boolean;
	isError: boolean;
	onRetry: () => void;
	className?: string;
};

export function ActivityInsightsWidget({
	insights,
	isPending,
	isError,
	onRetry,
	className = '',
}: ActivityInsightsWidgetProps) {
	const { t, i18n } = useTranslation('dashboard');
	const companyPath = useCompanyPath();
	const number = (value: number) => formatNumber(value, i18n.language);

	const recentDays = (insights?.activeByDay ?? []).slice(-14);
	const peak = Math.max(1, ...recentDays.map((day) => day.members));
	const shortDate: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

	return (
		<WidgetFrame
			title={t('activity.title')}
			subtitle={t('activity.subtitle')}
			actionTo={companyPath('activity')}
			actionLabel={t('activity.fullInsights')}
			actionContext={t('activity.title')}
			isPending={isPending}
			isError={isError}
			onRetry={onRetry}
			className={className}
		>
			{insights && (
				<div className="flex flex-1 flex-col gap-4">
					<figure className="m-0">
						<div className="flex h-28 items-end gap-1 rounded-box bg-base-200 p-4">
							{recentDays.map((day) => (
								<div
									key={day.day}
									className={`min-w-px flex-1 rounded-t-sm ${day.members > 0 ? 'bg-primary' : 'bg-base-300'}`}
									title={`${formatDate(day.day, i18n.language, shortDate)}: ${number(day.members)}`}
									style={{
										height:
											day.members > 0
												? `${Math.max(8, Math.round((day.members / peak) * 100))}%`
												: '2px',
									}}
								/>
							))}
						</div>
						<figcaption className="mt-2 flex items-center justify-between text-xs text-[var(--color-slate)]">
							<span>{t('activity.chartCaption')}</span>
							<span className="tabular-nums">
								{t('activity.activeMembersSummary', {
									active: number(insights.members.active),
									total: number(insights.members.total),
								})}
							</span>
						</figcaption>
					</figure>

					<dl className="grid grid-cols-2 gap-3 rounded-box bg-base-200 p-4 @sm:grid-cols-4">
						<div>
							<dt className="text-xs text-[var(--color-slate)]">
								{t('activity.security.changes')}
							</dt>
							<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
								{number(insights.changes.total)}
							</dd>
						</div>
						<div>
							<dt className="text-xs text-[var(--color-slate)]">
								{t('activity.security.roleChanges')}
							</dt>
							<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
								{number(insights.security.roleChanges)}
							</dd>
						</div>
						<div>
							<dt className="text-xs text-[var(--color-slate)]">
								{t('activity.security.passwordResets')}
							</dt>
							<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
								{number(insights.security.passwordResets)}
							</dd>
						</div>
						<div>
							<dt className="text-xs text-[var(--color-slate)]">
								{t('activity.security.denied')}
							</dt>
							<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
								{number(insights.security.deniedAttempts)}
							</dd>
						</div>
					</dl>

					<footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-base-300 pt-4">
						<span className="text-xs text-[var(--color-slate)]">
							{t('activity.visitsSummary', {
								count: insights.visits,
								formatted: number(insights.visits),
							})}
						</span>
						<Link to={companyPath('audit')} className="btn btn-sm border-0 bg-base-200">
							{t('activity.openAudit')}
						</Link>
					</footer>
				</div>
			)}
		</WidgetFrame>
	);
}

type ContactsWidgetProps = {
	contacts: DashboardContact[] | undefined;
	isPending: boolean;
	isError: boolean;
	onRetry: () => void;
	className?: string;
};

function presenceBadgeClass(status: DashboardContact['status']): string {
	switch (status) {
		case 'online':
			return 'badge-success badge-soft';
		case 'suspended':
			return 'badge-error badge-soft';
		default:
			return 'badge-ghost';
	}
}

export function ContactsWidget({
	contacts,
	isPending,
	isError,
	onRetry,
	className = '',
}: ContactsWidgetProps) {
	const { t, i18n } = useTranslation('dashboard');
	const { t: tContacts } = useTranslation('contacts');
	const companyPath = useCompanyPath();
	const roleName = useRoleName();
	const number = (value: number) => formatNumber(value, i18n.language);

	const list = contacts ?? [];
	const onlineCount = list.filter((c) => c.status === 'online').length;
	const sorted = [...list].sort((a, b) => {
		const rank = { online: 0, offline: 1, suspended: 2 };
		return rank[a.status] - rank[b.status];
	});

	return (
		<WidgetFrame
			title={t('contacts.title')}
			subtitle={t('contacts.subtitle')}
			actionTo={companyPath('contacts')}
			actionLabel={t('actions.viewAll')}
			actionContext={t('contacts.title')}
			badge={
				contacts && (
					<span className="badge badge-ghost badge-sm tabular-nums">
						{t('contacts.onlineBadge', {
							online: number(onlineCount),
							total: number(list.length),
						})}
					</span>
				)
			}
			isPending={isPending}
			isError={isError}
			onRetry={onRetry}
			className={className}
		>
			{sorted.length === 0 ? (
				<div className="flex flex-1 flex-col items-center justify-center rounded-box bg-base-200 px-6 py-8 text-center">
					<p className="text-sm font-medium text-base-content">{t('contacts.empty')}</p>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{t('contacts.emptyHint')}
					</p>
					<Link to={companyPath('contacts')} className="btn btn-primary btn-sm mt-4">
						{t('contacts.addAction')}
					</Link>
				</div>
			) : (
				<ul className="divide-y divide-base-300">
					{sorted.slice(0, 6).map((contact) => {
						const name = shownName(contact);
						return (
							<li
								key={contact.userId}
								className="flex items-center justify-between gap-3 py-3"
							>
								<div className="min-w-0">
									<p className="truncate text-sm font-medium text-base-content">
										<bdi>{name}</bdi>
									</p>
									<p className="truncate text-xs text-[var(--color-slate)]">
										{roleName(contact.role)}
									</p>
								</div>
								<span
									className={`badge badge-sm shrink-0 ${presenceBadgeClass(contact.status)}`}
								>
									{tContacts(`status.${contact.status}`)}
								</span>
							</li>
						);
					})}
				</ul>
			)}
		</WidgetFrame>
	);
}
