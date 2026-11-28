import { useTranslation } from 'react-i18next';
import type { InvoiceStatus } from '../api';

const STATUS_STYLE: Record<InvoiceStatus, string> = {
	draft: 'badge-neutral badge-soft',
	issued: 'badge-info badge-soft',
	paid_via_balance_offset: 'badge-success badge-soft',
	paid_via_bank_transfer: 'badge-success badge-soft',
	overdue: 'badge-error badge-soft',
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
	const { t } = useTranslation('billing');
	return (
		<span className={`badge badge-sm whitespace-nowrap ${STATUS_STYLE[status]}`}>
			{t(`invoices.status.${status}`)}
		</span>
	);
}
