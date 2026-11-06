import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Button, ModulePage, useToast } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { shownName, useCurrentWorkspace, useRoleName } from '@modules/auth';
import { ApiError } from '@services/api-client';
import type { Contact } from '../api';
import { CandidateTable } from '../components/CandidateTable';
import { ContactFilters } from '../components/ContactFilters';
import { useAddContact } from '../hooks/useContactMutations';
import { useCandidates, useContacts } from '../hooks/useContacts';
import { distinctRoles, filterContacts, groupByRole } from '../utils/contactGroups';

type Failure = { name: string; key: 'add.exists' | 'add.notEligible' | 'errors.unknown' };

// What went wrong when the API refused an add. Both refusals mean the page was out of date: the lists reload.
function failureKey(error: unknown): Failure['key'] {
	const code = error instanceof ApiError ? error.code : undefined;
	if (code === 'CONTACT_EXISTS') return 'add.exists';
	if (code === 'CONTACT_NOT_ELIGIBLE') return 'add.notEligible';
	return 'errors.unknown';
}

// The colleagues your role may add (the API decides who; this page only lists them). Selecting one adds them, goes
// back to the list and says so.
export function AddContactPage() {
	const { t, i18n } = useTranslation('contacts');
	const companyPath = useCompanyPath();
	const navigate = useNavigate();
	const { toast } = useToast();
	const workspace = useCurrentWorkspace();
	const roleName = useRoleName();
	const candidates = useCandidates();
	// Only for the roles you have already added everyone from; the page works without it.
	const contacts = useContacts();
	const add = useAddContact();
	const [search, setSearch] = useState('');
	const [roleCode, setRoleCode] = useState('all');
	const [failure, setFailure] = useState<Failure | null>(null);

	const header = (
		<ModulePage
			title={t('add.title')}
			description={t('add.description', {
				role: workspace ? roleName(workspace.role) : '',
				company: workspace?.name ?? '',
			})}
			actions={
				<Link to={companyPath('contacts')} className="btn border-0 bg-base-200 md:px-8">
					{t('add.back')}
				</Link>
			}
		/>
	);

	if (candidates.isPending)
		return (
			<div className="flex flex-col gap-6">
				{header}
				<span className="loading loading-spinner" aria-label={t('add.loading')} />
			</div>
		);
	if (candidates.isError)
		return (
			<div className="flex flex-col gap-6">
				{header}
				{candidates.error instanceof ApiError && candidates.error.status === 403 ? (
					<p role="alert" className="alert alert-soft text-sm">
						{t('page.noAccess')}
					</p>
				) : (
					<div
						role="alert"
						className="alert alert-error alert-soft flex flex-wrap text-sm"
					>
						{t('add.loadFailed')}
						<Button className="btn-sm" onClick={() => void candidates.refetch()}>
							{t('page.retry')}
						</Button>
					</div>
				)}
			</div>
		);

	const saved = contacts.data ?? [];
	const roles = distinctRoles([...candidates.data, ...saved]);
	// The role in the filter can run out of people while this page is open: fall back to every role.
	const activeRole = roles.some(({ code }) => code === roleCode) ? roleCode : 'all';
	const groups = groupByRole(
		filterContacts(candidates.data, search, activeRole),
		roleName,
		i18n.language,
	);
	// Roles you already have contacts in but nobody is left to add. Hidden while searching: a search narrows the list.
	const listed = new Set(candidates.data.map(({ role }) => role.code));
	const allAdded = search.trim()
		? []
		: groupByRole(filterContacts(saved, '', activeRole), roleName, i18n.language).filter(
				({ role }) => !listed.has(role.code),
			);

	const select = (person: Contact) => {
		setFailure(null);
		add.mutate(person.userId, {
			onSuccess: () => {
				toast({
					variant: 'success',
					title: t('add.added', { name: shownName(person) }),
				});
				void navigate(companyPath('contacts'));
			},
			onError: (error) => setFailure({ name: shownName(person), key: failureKey(error) }),
		});
	};

	return (
		<div className="flex flex-col gap-6">
			{header}
			<ContactFilters
				search={search}
				onSearchChange={setSearch}
				roleCode={activeRole}
				onRoleChange={setRoleCode}
				roles={roles}
			/>
			<div className="rounded-box bg-base-200 p-5">
				<h2 className="font-semibold">{t('add.policyTitle')}</h2>
				<p className="mt-2 text-sm text-[var(--color-slate)]">{t('add.policyBody')}</p>
			</div>
			{failure && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(failure.key, { name: failure.name })}
				</p>
			)}
			{groups.map(({ role, contacts: people }) => (
				<CandidateTable
					key={role.code}
					role={role}
					candidates={people}
					busy={add.isPending}
					onSelect={select}
				/>
			))}
			{allAdded.map(({ role }) => (
				<p key={role.code} className="text-sm text-[var(--color-slate)]">
					{t('add.allAdded', { role: roleName(role) })}
				</p>
			))}
			{groups.length === 0 && allAdded.length === 0 && (
				<p className="py-8 text-center text-[var(--color-slate)]">
					{candidates.data.length === 0 && saved.length === 0
						? t('add.none')
						: t('empty.noMatch')}
				</p>
			)}
		</div>
	);
}
