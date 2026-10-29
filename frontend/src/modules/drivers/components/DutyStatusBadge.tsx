import { useTranslation } from 'react-i18next';
import type { DispatchStatus } from '../api';

const BADGE_CLASS: Record<DispatchStatus, string> = {
	available: 'badge-success badge-soft',
	on_pickup: 'badge-info badge-soft',
	out_for_delivery: 'badge-info badge-soft',
	off_duty: 'badge-ghost',
	suspended: 'badge-error badge-soft',
};

export function DutyStatusBadge({ status }: { status: DispatchStatus }) {
	const { t } = useTranslation('drivers');
	return (
		<span className={`badge badge-sm whitespace-nowrap ${BADGE_CLASS[status]}`}>
			{t(`dispatchStatus.${status}`)}
		</span>
	);
}
