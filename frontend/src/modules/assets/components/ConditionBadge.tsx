import { useTranslation } from 'react-i18next';
import type { AssetCondition } from '../api';

const BADGE_CLASS: Record<AssetCondition, string> = {
	new: 'badge-info badge-soft',
	good: 'badge-success badge-soft',
	needs_maintenance: 'badge-warning badge-soft',
	decommissioned: 'badge-ghost',
};

export function ConditionBadge({ condition }: { condition: AssetCondition }) {
	const { t } = useTranslation('assets');
	return (
		<span className={`badge badge-sm whitespace-nowrap ${BADGE_CLASS[condition]}`}>
			{t(`condition.${condition}`)}
		</span>
	);
}
