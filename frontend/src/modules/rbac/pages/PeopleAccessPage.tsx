import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AnalyticsCard, Button, ModulePage, Table, TipCard } from '@global-components';
import type { TableColumn } from '@global-components';
import { useAuth } from '@hooks/useAuth';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { shownName, useCurrentWorkspace, useRoleName } from '@modules/auth';
import { ApiError } from '@services/api-client';
import { formatDate, formatNumber } from '@utils/format';
import type { CreateInviteResponse, Member } from '../api';
import { CompanyDataExport } from '../components/CompanyDataExport';
import { CreateInviteDialog } from '../components/CreateInviteDialog';
import { InviteCreatedDialog } from '../components/InviteCreatedDialog';
import { InvitesOverview } from '../components/InvitesOverview';
import { ManageMemberDialog } from '../components/ManageMemberDialog';
import { PeopleAccessTabs } from '../components/PeopleAccessTabs';
import { RolesOverview } from '../components/RolesOverview';
import { useInvites, useMembers } from '../hooks';

// People & access: the company's members for anyone with admin.manage_users (the API refuses everyone else). The
// "invites" tab manages single-use sign-up links; "roles" (admin.manage_roles) shows what each role allows.
export function PeopleAccessPage({
	tab = 'members',
}: {
	tab?: 'members' | 'invites' | 'roles' | 'export';
}) {
	const { t, i18n } = useTranslation('rbac');
	const companyPath = useCompanyPath();
	const workspace = useCurrentWorkspace();
	const company = workspace?.name ?? '';
	const roleName = useRoleName();
	const { userId } = useAuth();
	const members = useMembers();
	const invites = useInvites();
	const [search, setSearch] = useState('');
	const [managedId, setManagedId] = useState<string | null>(null);
	const [inviteOpen, setInviteOpen] = useState(false);
	const [createdInvite, setCreatedInvite] = useState<CreateInviteResponse | null>(null);

	const header = (
		<ModulePage
			title={t('page.title')}
			description={t('page.description', { company })}
			actions={
				members.isSuccess && (
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							className="btn bg-base-200"
							onClick={() => setInviteOpen(true)}
						>
							{t('page.invite')}
						</button>
						<Link to={companyPath('rbac/new')} className="btn btn-primary">
							{t('page.create')}
						</Link>
					</div>
				)
			}
		/>
	);

	if (members.isPending)
		return (
			<div className="flex flex-col gap-6">
				{header}
				<span className="loading loading-spinner" aria-label={t('page.loading')} />
			</div>
		);
	if (members.isError)
		return (
			<div className="flex flex-col gap-6">
				{header}
				{members.error instanceof ApiError && members.error.status === 403 ? (
					<p role="alert" className="alert alert-soft text-sm">
						{t('page.noAccess')}
					</p>
				) : (
					<div
						role="alert"
						className="alert alert-error alert-soft flex flex-wrap text-sm"
					>
						{t('page.loadFailed')}
						<Button className="btn-sm" onClick={() => void members.refetch()}>
							{t('page.retry')}
						</Button>
					</div>
				)}
			</div>
		);

	const list = members.data;
	const active = list.filter((member) => member.isActive).length;
	const admins = list.filter(
		(member) => member.isActive && member.role.code === 'org_admin',
	).length;
	const count = (value: number) => formatNumber(value, i18n.language);
	const needle = search.trim().toLowerCase();
	const rows = needle
		? list.filter(({ username, email, displayName }) =>
				[username, email, displayName ?? ''].some((text) =>
					text.toLowerCase().includes(needle),
				),
			)
		: list;
	const managed = list.find((member) => member.userId === managedId);

	const columns: TableColumn<Member>[] = [
		{
			key: 'member',
			header: t('table.member'),
			cell: (member) => (
				<div>
					<p className="font-medium">{shownName(member)}</p>
					{member.displayName && (
						<p className="text-xs text-[var(--color-slate)]">
							<span dir="ltr">{member.username}</span>
						</p>
					)}
					<p className="text-xs text-[var(--color-slate)]">
						<span dir="ltr">{member.email}</span>
					</p>
				</div>
			),
		},
		{ key: 'role', header: t('table.role'), cell: (member) => roleName(member.role) },
		{
			key: 'status',
			header: t('table.status'),
			cell: (member) => t(statusKey(member)),
		},
		{
			key: 'lastLogin',
			header: t('table.lastLogin'),
			cell: (member) =>
				member.lastLoginAt
					? formatDate(new Date(member.lastLoginAt), i18n.language, {
							dateStyle: 'medium',
						})
					: t('table.never'),
		},
		{
			key: 'action',
			header: t('table.action'),
			cell: (member) =>
				member.userId === userId ? (
					<span aria-label={t('table.you')}>—</span>
				) : (
					<button
						type="button"
						className="btn btn-ghost btn-sm"
						aria-label={t('table.manageNamed', { name: member.username })}
						onClick={() => setManagedId(member.userId)}
					>
						{t('table.manage')}
					</button>
				),
		},
	];

	return (
		<div className="flex flex-col gap-6">
			{header}
			<AnalyticsCard
				items={[
					{
						label: t('tiles.members'),
						value: count(list.length),
						description: t('tiles.membersNote'),
					},
					{
						label: t('tiles.active'),
						value: count(active),
						description: t('tiles.inactive', { n: count(list.length - active) }),
					},
					{
						label: t('tiles.admins'),
						value: count(admins),
						description: t('tiles.adminsNote'),
					},
				]}
			/>
			<section className="flex flex-col gap-4">
				<div>
					<h2 className="font-semibold">
						{tab === 'roles'
							? t('roles.title')
							: tab === 'invites'
								? t('invites.title')
								: tab === 'export'
									? t('export.title')
									: t('table.title')}
					</h2>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{tab === 'roles'
							? t('roles.description', { company })
							: tab === 'invites'
								? t('invites.description', { company })
								: tab === 'export'
									? t('export.description', { company })
									: t('table.description')}
					</p>
				</div>
				<PeopleAccessTabs
					members={list.length}
					pendingInvites={
						invites.data?.filter((invite) => invite.status === 'pending').length ?? 0
					}
				/>
				{tab === 'roles' ? (
					<RolesOverview />
				) : tab === 'invites' ? (
					<InvitesOverview />
				) : tab === 'export' ? (
					<CompanyDataExport slug={workspace?.slug} />
				) : (
					<Table
						caption={t('table.title')}
						columns={columns}
						rows={rows}
						getRowKey={(member) => member.userId}
						search={{
							value: search,
							onChange: setSearch,
							placeholder: t('table.search'),
						}}
						emptyMessage={needle ? t('table.noMatch') : t('table.empty')}
					/>
				)}
			</section>
			<TipCard title={t('tip.title')} description={t('tip.description')} />
			{managed && (
				<ManageMemberDialog
					key={managed.userId}
					member={managed}
					company={company}
					onClose={() => setManagedId(null)}
				/>
			)}
			{inviteOpen && (
				<CreateInviteDialog
					company={company}
					onCreated={(result) => {
						setInviteOpen(false);
						setCreatedInvite(result);
					}}
					onClose={() => setInviteOpen(false)}
				/>
			)}
			{createdInvite && (
				<InviteCreatedDialog
					created={createdInvite}
					company={company}
					onClose={() => setCreatedInvite(null)}
				/>
			)}
		</div>
	);
}

// The membership being off wins; a flagged account still has to choose its password.
function statusKey(member: Member) {
	if (!member.isActive) return 'status.inactive' as const;
	return member.mustChangePassword ? ('status.mustChange' as const) : ('status.active' as const);
}
