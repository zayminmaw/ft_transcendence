import { useTranslation } from 'react-i18next';
import type { AuditChange } from '../api';
import { displayValue, fieldLabel } from '../utils/describe';

// "Status: BEFORE pending → AFTER paid". Each value is a <bdi>, so codes and numbers stay readable in Arabic while
// the chip itself reads in the page direction.
export function ChangeChip({ field, change }: { field: string; change: AuditChange }) {
	const { t, i18n } = useTranslation('audit');
	const language = i18n.resolvedLanguage ?? 'en';
	return (
		<span className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-base-300 bg-base-200 px-2 py-1 text-xs">
			<span className="font-medium">{fieldLabel(t, field)}:</span>
			<span className="inline-flex flex-wrap items-center gap-1.5">
				<span className="rounded bg-warning/25 px-1.5 py-0.5">
					<span className="me-1 text-[10px] uppercase text-[var(--color-slate)]">
						{t('before')}
					</span>
					<bdi>{displayValue(t, change.before, language, field)}</bdi>
				</span>
				<span
					aria-hidden="true"
					className="inline-block text-[var(--color-slate)] rtl:-scale-x-100"
				>
					→
				</span>
				<span className="rounded bg-success/15 px-1.5 py-0.5">
					<span className="me-1 text-[10px] uppercase text-[var(--color-slate)]">
						{t('after')}
					</span>
					<bdi>{displayValue(t, change.after, language, field)}</bdi>
				</span>
			</span>
		</span>
	);
}
