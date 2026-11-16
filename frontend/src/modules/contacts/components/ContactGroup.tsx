import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Table } from '@global-components';
import type { TableColumn } from '@global-components';
import { shownName, useRoleName } from '@modules/auth';
import { formatNumber } from '@utils/format';
import type { Contact } from '../api';

// One role's contacts: a table from tablet width up, cards on a phone. Status is plain text and follows the cached
// list, so a live change shows here without a reload.
export function ContactGroup({
	role,
	contacts,
	onRemove,
}: {
	role: Contact['role'];
	contacts: Contact[];
	onRemove: (contact: Contact) => void;
}) {
	const { t, i18n } = useTranslation('contacts');
	const roleName = useRoleName();
	const headingId = useId();
	const label = roleName(role);
	const title = t('group.title', {
		role: label,
		count: formatNumber(contacts.length, i18n.language),
	});

	const removeButton = (contact: Contact) => (
		<button
			type="button"
			className="btn btn-ghost btn-sm"
			aria-label={t('table.removeNamed', { name: shownName(contact) })}
			onClick={() => onRemove(contact)}
		>
			{t('table.remove')}
		</button>
	);

	const columns: TableColumn<Contact>[] = [
		{
			key: 'contact',
			header: t('table.contact'),
			cell: (contact) => (
				<span className="block max-w-64 truncate font-medium" title={shownName(contact)}>
					{shownName(contact)}
				</span>
			),
		},
		{ key: 'role', header: t('table.role'), cell: () => label },
		{
			key: 'username',
			header: t('table.username'),
			cell: (contact) => (
				<span dir="ltr" className="block max-w-48 truncate" title={contact.username}>
					{contact.username}
				</span>
			),
		},
		{
			key: 'status',
			header: t('table.status'),
			cell: (contact) => t(`status.${contact.status}`),
		},
		{ key: 'action', header: t('table.action'), cell: removeButton },
	];

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3">
			<h2 id={headingId} className="font-semibold">
				{title}
			</h2>
			<div className="hidden md:block">
				<Table
					caption={title}
					columns={columns}
					rows={contacts}
					getRowKey={(contact) => contact.userId}
				/>
			</div>
			<ul className="flex flex-col gap-3 md:hidden">
				{contacts.map((contact) => (
					<li
						key={contact.userId}
						className="flex items-center justify-between gap-3 rounded-box bg-base-200 p-4"
					>
						<div className="min-w-0">
							<p className="truncate font-medium">{shownName(contact)}</p>
							<p className="text-xs text-[var(--color-slate)] [overflow-wrap:anywhere]">
								{label} ·{' '}
								<span dir="ltr" className="inline-block">
									{contact.username}
								</span>
							</p>
							<p className="mt-1 text-sm">{t(`status.${contact.status}`)}</p>
						</div>
						{removeButton(contact)}
					</li>
				))}
			</ul>
		</section>
	);
}
