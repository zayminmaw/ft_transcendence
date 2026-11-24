import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber } from '@utils/format';

// One bar for each day, no chart library. The tallest day fills the height; a day with no one is a thin tick. A hover
// tooltip reaches only a mouse, so the numbers are also in a table that anyone can open, by keyboard or touch.
export function DayBars({ days }: { days: { day: string; members: number }[] }) {
	const { t, i18n } = useTranslation('insights');
	const tallest = Math.max(0, ...days.map((entry) => entry.members));
	const short: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
	const first = days[0]?.day;
	const last = days[days.length - 1]?.day;

	return (
		<figure className="flex flex-col gap-2">
			<div
				role="img"
				aria-label={t('byDay.summary', { max: formatNumber(tallest, i18n.language) })}
				className="flex h-40 items-end gap-px rounded-box bg-base-200 p-4"
			>
				{days.map(({ day, members }) => (
					<div
						key={day}
						title={`${formatDate(day, i18n.language, short)}: ${formatNumber(members, i18n.language)}`}
						className={`min-w-px flex-1 rounded-t-sm ${members > 0 ? 'bg-primary' : 'bg-base-300'}`}
						style={{
							height:
								members > 0 ? `${Math.max(4, (members / tallest) * 100)}%` : '2px',
						}}
					/>
				))}
			</div>
			{first && last && (
				<figcaption className="flex justify-between text-xs text-[var(--color-slate)]">
					<span>{formatDate(first, i18n.language, short)}</span>
					<span>{formatDate(last, i18n.language, short)}</span>
				</figcaption>
			)}
			<details className="rounded-box border border-base-300">
				<summary className="cursor-pointer px-4 py-2 text-sm">
					{t('byDay.showTable')}
				</summary>
				<div
					role="region"
					aria-label={t('byDay.title')}
					tabIndex={0}
					className="max-h-64 overflow-y-auto px-4 pb-2"
				>
					<table className="table table-sm">
						<caption>{t('byDay.title')}</caption>
						<thead>
							<tr>
								<th>{t('byDay.day')}</th>
								<th>{t('byDay.members')}</th>
							</tr>
						</thead>
						<tbody>
							{days.map(({ day, members }) => (
								<tr key={day}>
									<td>{formatDate(day, i18n.language)}</td>
									<td>{formatNumber(members, i18n.language)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</figure>
	);
}
