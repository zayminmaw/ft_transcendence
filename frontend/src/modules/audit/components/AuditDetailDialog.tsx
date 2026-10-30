import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@global-components';
import { formatDate } from '@utils/format';
import type { AuditEntry } from '../api';
import { useAuditEntry } from '../hooks/useAuditLogs';
import {
	actorText,
	changeRows,
	describeEntry,
	displayValue,
	fieldLabel,
	lookup,
	resourceName,
	resourceText,
} from '../utils/describe';
import { ActionBadge } from './ActionBadge';
import { ChangeChip } from './ChangeChip';

// One entry in full: who, what, when, from where, and every recorded field. `entry` shows at once; the details
// request adds the user agent.
export function AuditDetailDialog({
	entry,
	onClose,
}: {
	entry: AuditEntry | null;
	onClose: () => void;
}) {
	const { t, i18n } = useTranslation('audit');
	const language = i18n.resolvedLanguage ?? 'en';
	const { data } = useAuditEntry(entry?.id ?? null);
	const shown = data ?? entry;
	const rows = shown ? changeRows(shown) : [];

	return (
		<Dialog
			open={entry !== null}
			onClose={onClose}
			title={shown ? t('detailsTitle', { id: shown.id }) : ''}
			className="w-11/12 max-w-3xl!"
			actions={
				<button type="button" className="btn" onClick={onClose}>
					{t('close')}
				</button>
			}
		>
			{shown && (
				<div className="flex flex-col gap-4 text-sm">
					<dl className="grid grid-cols-2 gap-4 rounded-box border border-base-300 bg-base-200 p-4 sm:grid-cols-3">
						<Fact label={t('columns.operator')}>
							{actorText(t, shown)}
							{shown.actor.role && ` (${lookup(t, 'roles', shown.actor.role)})`}
						</Fact>
						<Fact label={t('columns.action')}>
							<ActionBadge entry={shown} />
						</Fact>
						<Fact label={t('columns.resource')}>
							{resourceName(t, shown.resource.type)}{' '}
							<bdi className="font-mono">{resourceText(shown)}</bdi>
						</Fact>
						<Fact label={t('columns.time')}>
							<span className="font-mono">
								{formatDate(shown.occurredAt, language, {
									dateStyle: 'medium',
									timeStyle: 'medium',
								})}
							</span>
						</Fact>
						<Fact label={t('columns.ip')}>
							<bdi className="font-mono">
								{shown.ip?.replace(/^::ffff:/, '') ?? '—'}
							</bdi>
						</Fact>
						<Fact label={t('outcome')}>{t(`outcomes.${shown.outcome}`)}</Fact>
					</dl>

					<section>
						<h3 className="text-xs text-[var(--color-slate)] uppercase">
							{t('columns.description')}
						</h3>
						<p className="mt-1 font-medium">{describeEntry(t, shown)}</p>
					</section>

					{shown.changes === null ? (
						<p className="text-[var(--color-slate)]">{t('valuesWithheld')}</p>
					) : (
						rows.length > 0 && (
							<section className="overflow-hidden rounded-box border border-base-300">
								<h3 className="flex justify-between gap-2 border-b border-base-300 bg-base-200 px-4 py-2 text-xs uppercase">
									<span>{t('fieldChanges')}</span>
									<span className="text-[var(--color-slate)] normal-case">
										{t('fieldsChanged', {
											count: rows.filter((row) => row.changed).length,
										})}
									</span>
								</h3>
								<ul className="divide-y divide-base-300">
									{rows.map(({ field, change, changed }) => (
										<li key={field} className="px-4 py-2">
											{changed ? (
												<ChangeChip field={field} change={change} />
											) : (
												<span className="text-xs">
													<span className="font-medium">
														{fieldLabel(t, field)}:
													</span>{' '}
													<bdi className="font-mono">
														{displayValue(t, change.after, language)}
													</bdi>
												</span>
											)}
										</li>
									))}
								</ul>
							</section>
						)
					)}

					{(shown.requestId || shown.userAgent) && (
						<dl className="grid gap-1 text-xs text-[var(--color-slate)]">
							{shown.requestId && (
								<div>
									<dt className="inline">{t('requestId')}: </dt>
									<dd className="inline font-mono">{shown.requestId}</dd>
								</div>
							)}
							{shown.userAgent && (
								<div>
									<dt className="inline">{t('userAgent')}: </dt>
									<dd className="inline break-all">{shown.userAgent}</dd>
								</div>
							)}
						</dl>
					)}
				</div>
			)}
		</Dialog>
	);
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div>
			<dt className="text-xs text-[var(--color-slate)] uppercase">{label}</dt>
			<dd className="mt-1 font-medium">{children}</dd>
		</div>
	);
}
