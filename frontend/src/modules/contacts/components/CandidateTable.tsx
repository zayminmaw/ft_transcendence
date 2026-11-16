import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Table } from '@global-components';
import type { TableColumn } from '@global-components';
import { shownName, useRoleName } from '@modules/auth';
import { formatNumber } from '@utils/format';
import type { Contact } from '../api';

// One role's colleagues you can still add: a table from tablet width up, cards on a phone. Select adds the person.
export function CandidateTable({
	role,
	candidates,
	busy,
	onSelect,
}: {
	role: Contact['role'];
	candidates: Contact[];
	// A call is running: every Select waits, so one click can't add two people.
	busy: boolean;
	onSelect: (candidate: Contact) => void;
}) {
	const { t, i18n } = useTranslation('contacts');
	const roleName = useRoleName();
	const headingId = useId();
	const label = roleName(role);
	const title = t('add.groupTitle', {
		role: label,
		count: formatNumber(candidates.length, i18n.language),
	});

	const selectButton = (candidate: Contact) => (
		<button
			type="button"
			className="btn btn-neutral btn-sm"
			disabled={busy}
			aria-label={t('add.selectNamed', { name: shownName(candidate) })}
			onClick={() => onSelect(candidate)}
		>
			{t('add.select')}
		</button>
	);

	const columns: TableColumn<Contact>[] = [
		{
			key: 'contact',
			header: t('table.contact'),
			cell: (candidate) => (
				<span className="block max-w-64 truncate font-medium" title={shownName(candidate)}>
					{shownName(candidate)}
				</span>
			),
		},
		{ key: 'role', header: t('table.role'), cell: () => label },
		{
			key: 'username',
			header: t('table.username'),
			cell: (candidate) => (
				<span dir="ltr" className="block max-w-48 truncate" title={candidate.username}>
					{candidate.username}
				</span>
			),
		},
		{ key: 'action', header: t('table.action'), cell: selectButton },
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
					rows={candidates}
					getRowKey={(candidate) => candidate.userId}
				/>
			</div>
			<ul className="flex flex-col gap-3 md:hidden">
				{candidates.map((candidate) => (
					<li
						key={candidate.userId}
						className="flex items-center justify-between gap-3 rounded-box bg-base-200 p-4"
					>
						<div className="min-w-0">
							<p className="truncate font-medium">{shownName(candidate)}</p>
							<p className="text-xs text-[var(--color-slate)] [overflow-wrap:anywhere]">
								{label} ·{' '}
								<span dir="ltr" className="inline-block">
									{candidate.username}
								</span>
							</p>
						</div>
						{selectButton(candidate)}
					</li>
				))}
			</ul>
		</section>
	);
}
