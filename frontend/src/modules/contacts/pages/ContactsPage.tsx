import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, ModulePage } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { useCurrentWorkspace, useRoleName } from '@modules/auth';
import { ApiError } from '@services/api-client';
import type { Contact } from '../api';
import { ContactFilters } from '../components/ContactFilters';
import { ContactGroup } from '../components/ContactGroup';
import { RemoveContactDialog } from '../components/RemoveContactDialog';
import { useContacts } from '../hooks/useContacts';
import { distinctRoles, filterContacts, groupByRole } from '../utils/contactGroups';

// Your saved colleagues in the open company, grouped by role, with their status. Status changes arrive through the
// company's live connection (useLiveUpdates) and land in the same cached list this page reads.
export function ContactsPage() {
	const { t, i18n } = useTranslation('contacts');
	const companyPath = useCompanyPath();
	const company = useCurrentWorkspace()?.name ?? '';
	const roleName = useRoleName();
	const contacts = useContacts();
	const [search, setSearch] = useState('');
	const [roleCode, setRoleCode] = useState('all');
	const [removing, setRemoving] = useState<Contact | null>(null);

	const header = (
		<ModulePage
			title={t('page.title')}
			description={t('page.description', { company })}
			actions={
				<Link to={companyPath('contacts/add')} className="btn btn-primary md:px-8">
					{t('page.add')}
				</Link>
			}
		/>
	);

	if (contacts.isPending)
		return (
			<div className="flex flex-col gap-6">
				{header}
				<span className="loading loading-spinner" aria-label={t('page.loading')} />
			</div>
		);
	if (contacts.isError)
		return (
			<div className="flex flex-col gap-6">
				{header}
				{contacts.error instanceof ApiError && contacts.error.status === 403 ? (
					<p role="alert" className="alert alert-soft text-sm">
						{t('page.noAccess')}
					</p>
				) : (
					<div
						role="alert"
						className="alert alert-error alert-soft flex flex-wrap text-sm"
					>
						{t('page.loadFailed')}
						<Button className="btn-sm" onClick={() => void contacts.refetch()}>
							{t('page.retry')}
						</Button>
					</div>
				)}
			</div>
		);

	const roles = distinctRoles(contacts.data);
	// The last contact of a role can be removed while that role is the filter: fall back to every role.
	const activeRole = roles.some(({ code }) => code === roleCode) ? roleCode : 'all';
	const groups = groupByRole(
		filterContacts(contacts.data, search, activeRole),
		roleName,
		i18n.language,
	);

	return (
		<div className="flex flex-col gap-6">
			{header}
			{contacts.data.length === 0 ? (
				<div className="flex flex-col items-start gap-3 rounded-box bg-base-200 p-6">
					<h2 className="font-semibold">{t('empty.title')}</h2>
					<p className="text-sm text-[var(--color-slate)]">{t('empty.description')}</p>
					<Link to={companyPath('contacts/add')} className="btn btn-neutral">
						{t('page.add')}
					</Link>
				</div>
			) : (
				<>
					<ContactFilters
						search={search}
						onSearchChange={setSearch}
						roleCode={activeRole}
						onRoleChange={setRoleCode}
						roles={roles}
					/>
					{groups.length === 0 ? (
						<p className="py-8 text-center text-[var(--color-slate)]">
							{t('empty.noMatch')}
						</p>
					) : (
						groups.map(({ role, contacts: people }) => (
							<ContactGroup
								key={role.code}
								role={role}
								contacts={people}
								onRemove={setRemoving}
							/>
						))
					)}
					<p className="text-sm text-[var(--color-slate)]">{t('footer')}</p>
				</>
			)}
			{removing && (
				<RemoveContactDialog contact={removing} onClose={() => setRemoving(null)} />
			)}
		</div>
	);
}
