import { useTranslation } from 'react-i18next';
import { Table } from '@global-components';
import type { TableColumn, TablePaginationProps } from '@global-components';
import { formatDate } from '@utils/format';
import type { AuditEntry } from '../api';
import {
	actorText,
	changeRows,
	describeEntry,
	lookup,
	resourceName,
	resourceText,
} from '../utils/describe';
import { ActionBadge } from './ActionBadge';
import { ChangeChip } from './ChangeChip';

// The audit table shared by the company log and one record's history.
export function AuditLogTable({
	entries,
	onSelect,
	pagination,
	showResource = true,
}: {
	entries: AuditEntry[];
	onSelect: (entry: AuditEntry) => void;
	pagination?: TablePaginationProps;
	// One record's history already says which record it is.
	showResource?: boolean;
}) {
	const { t, i18n } = useTranslation('audit');
	const language = i18n.resolvedLanguage ?? 'en';

	const columns: TableColumn<AuditEntry>[] = [
		{
			key: 'time',
			header: t('columns.time'),
			className: 'whitespace-nowrap font-mono text-xs text-[var(--color-slate)]',
			cell: (entry) =>
				formatDate(entry.occurredAt, language, {
					dateStyle: 'medium',
					timeStyle: 'medium',
				}),
		},
		{
			key: 'operator',
			header: t('columns.operator'),
			className: 'whitespace-nowrap',
			cell: (entry) => (
				<div>
					<p className="font-medium">{actorText(t, entry)}</p>
					{entry.actor.role && (
						<p className="mt-1 text-xs text-[var(--color-slate)]">
							{lookup(t, 'roles', entry.actor.role)}
						</p>
					)}
				</div>
			),
		},
		{
			key: 'action',
			header: t('columns.action'),
			cell: (entry) => <ActionBadge entry={entry} />,
		},
		...(showResource
			? [
					{
						key: 'resource',
						header: t('columns.resource'),
						className: 'whitespace-nowrap',
						cell: (entry: AuditEntry) =>
							entry.resource.type && (
								<span className="inline-flex items-center gap-2">
									<span className="badge badge-sm border-base-300 bg-base-200 uppercase">
										{resourceName(t, entry.resource.type)}
									</span>
									<bdi className="font-mono text-xs">{resourceText(entry)}</bdi>
								</span>
							),
					},
				]
			: []),
		{
			key: 'description',
			header: t('columns.description'),
			className: 'min-w-64',
			cell: (entry) => <EntrySummary entry={entry} />,
		},
		{
			key: 'ip',
			header: t('columns.ip'),
			className: 'whitespace-nowrap font-mono text-xs text-[var(--color-slate)]',
			cell: (entry) => <bdi>{entry.ip?.replace(/^::ffff:/, '') ?? '—'}</bdi>,
		},
		{
			key: 'details',
			header: t('columns.details'),
			className: 'text-end',
			cell: (entry) => (
				<button
					type="button"
					className="btn btn-sm btn-outline whitespace-nowrap"
					onClick={() => onSelect(entry)}
				>
					{t('viewDetails')}
				</button>
			),
		},
	];

	return (
		<Table
			caption={t('caption')}
			columns={columns}
			rows={entries}
			getRowKey={(entry) => entry.id}
			pagination={pagination}
			emptyMessage={t('empty')}
		/>
	);
}

// The sentence, then one chip per changed field.
function EntrySummary({ entry }: { entry: AuditEntry }) {
	const { t } = useTranslation('audit');
	const changed = changeRows(entry).filter((row) => row.changed);
	return (
		<div className="flex flex-col items-start gap-1.5">
			<p>{describeEntry(t, entry)}</p>
			{changed.map(({ field, change }) => (
				<ChangeChip key={field} field={field} change={change} />
			))}
		</div>
	);
}
