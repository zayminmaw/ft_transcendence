import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuditAccess } from '../hooks/useAuditLogs';
import { ItemAuditModal, type ItemAuditModalProps } from './ItemAuditModal';

// Drop next to any record: <InspectChangesButton resourceType="invoice" recordId={id} title={number} />.
// Shown only to people who may read the audit trail (admin.audit_logs).
export function InspectChangesButton({
	className = '',
	...record
}: Omit<ItemAuditModalProps, 'open' | 'onClose'> & { className?: string }) {
	const { t } = useTranslation('audit');
	const canRead = useAuditAccess();
	const [open, setOpen] = useState(false);
	if (!canRead) return null;

	return (
		<>
			<button
				type="button"
				className={`btn btn-sm btn-outline ${className}`}
				onClick={() => setOpen(true)}
			>
				<svg
					aria-hidden="true"
					className="size-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
					<path d="M3 3v5h5M12 7v5l4 2" />
				</svg>
				{t('inspectChanges')}
			</button>
			<ItemAuditModal {...record} open={open} onClose={() => setOpen(false)} />
		</>
	);
}
