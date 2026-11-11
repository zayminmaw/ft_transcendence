import { useTranslation } from 'react-i18next';
import { SelectFilter } from '@global-components';
import { RANGES, type InsightsRange } from '../api';

// How far back the page looks.
export function RangeSelect({
	value,
	onChange,
}: {
	value: InsightsRange;
	onChange: (range: InsightsRange) => void;
}) {
	const { t } = useTranslation('insights');
	return (
		<SelectFilter
			label={t('range.label')}
			value={String(value)}
			onChange={(next) => onChange(Number(next) as InsightsRange)}
			options={RANGES.map((days) => ({
				value: String(days),
				label: t(`range.last${days}`),
			}))}
		/>
	);
}
