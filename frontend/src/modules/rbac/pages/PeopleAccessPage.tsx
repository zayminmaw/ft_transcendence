import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AnalyticsCard, Button, ModulePage, Table, TipCard } from '@global-components';
import type { TableColumn } from '@global-components';
import { useAuth } from '@hooks/useAuth';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { useCurrentWorkspace, useRoleName } from '@modules/auth';
import { ApiError } from '@services/api-client';
import { formatDate, formatNumber } from '@utils/format';
import type { Member } from '../api';
import { ManageMemberDialog } from '../components/ManageMemberDialog';
import { useMembers } from '../hooks';

// People & access: the company's members for anyone with admin.manage_users (the API refuses everyone else).
export function PeopleAccessPage() {
	const { t, i18n } = useTranslation('rbac');
	const companyPath = useCompanyPath();
	const company = useCurrentWorkspace()?.name ?? '';
	const roleName = useRoleName();
	const { userId } = useAuth();
	const members = useMembers();
	const [search, setSearch] = useState('');
	const [managedId, setManagedId] = useState<string | null>(null);

	const header = (
		<ModulePage
			title={t('page.title')}
			description={t('page.description', { company })}
			actions={
				members.isSuccess && (
					<Link to={companyPath('rbac/new')} className="btn btn-primary">
						{t('page.create')}
					</Link>
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
		? list.filter(
				({ username, email }) =>
					username.toLowerCase().includes(needle) || email.toLowerCase().includes(needle),
			)
		: list;
	const managed = list.find((member) => member.userId === managedId);

	const columns: TableColumn<Member>[] = [
		{
			key: 'member',
			header: t('table.member'),
			cell: (member) => (
				<div>
					<p className="font-medium">{member.username}</p>
					<p className="text-xs text-[var(--color-slate)]">{member.email}</p>
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
					<h2 className="font-semibold">{t('table.title')}</h2>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{t('table.description')}
					</p>
				</div>
				<Table
					caption={t('table.title')}
					columns={columns}
					rows={rows}
					getRowKey={(member) => member.userId}
					search={{ value: search, onChange: setSearch, placeholder: t('table.search') }}
					emptyMessage={needle ? t('table.noMatch') : t('table.empty')}
				/>
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
		</div>
	);
}

// The membership being off wins; a flagged account still has to choose its password.
function statusKey(member: Member) {
	if (!member.isActive) return 'status.inactive' as const;
	return member.mustChangePassword ? ('status.mustChange' as const) : ('status.active' as const);
}
