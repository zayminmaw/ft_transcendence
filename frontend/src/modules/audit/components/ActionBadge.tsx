import { useTranslation } from 'react-i18next';
import type { AuditEntry } from '../api';

// Theme colours by meaning: additions succeed, removals and security alarms are errors, status moves inform.
const TONE: Partial<Record<AuditEntry['action'], string>> = {
	create: 'badge-success',
	delete: 'badge-error',
	status_change: 'badge-info',
	transfer: 'badge-accent',
	assign: 'badge-accent',
	revoke: 'badge-warning',
	login_failed: 'badge-error',
	session_reuse: 'badge-error',
	password_reset: 'badge-warning',
};

export function ActionBadge({ entry }: { entry: AuditEntry }) {
	const { t } = useTranslation('audit');
	const tone = entry.outcome === 'denied' ? 'badge-error' : (TONE[entry.action] ?? '');
	return (
		<span className={`badge badge-sm badge-soft whitespace-nowrap uppercase ${tone}`}>
			{t(`actionNames.${entry.action}`)}
			{entry.outcome !== 'success' && (
				<span className="sr-only">, {t(`outcomes.${entry.outcome}`)}</span>
			)}
		</span>
	);
}
