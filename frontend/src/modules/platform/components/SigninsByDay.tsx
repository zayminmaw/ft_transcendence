import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber } from '@utils/format';
import type { SigninDay } from '../api';

// One bar for each day showing its failed sign-ins, no chart library. The busiest day fills the height; a day with
// none is a thin tick. A hover tooltip reaches only a mouse, so the numbers are also in a table that anyone can open,
// by keyboard or touch.
export function SigninsByDay({ days }: { days: SigninDay[] }) {
	const { t, i18n } = useTranslation('platform');
	const tallest = Math.max(0, ...days.map((entry) => entry.failedSignIns));
	const short: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
	const first = days[0]?.day;
	const last = days[days.length - 1]?.day;
	const number = (value: number) => formatNumber(value, i18n.language);

	return (
		<figure className="flex flex-col gap-2">
			<div
				role="img"
				aria-label={t('signins.byDay.summary', { max: number(tallest) })}
				className="flex h-40 items-end gap-px rounded-box bg-base-200 p-4"
			>
				{days.map(({ day, failedSignIns, signIns }) => (
					<div
						key={day}
						title={`${formatDate(day, i18n.language, short)}: ${number(failedSignIns)} / ${number(signIns + failedSignIns)}`}
						className={`min-w-px flex-1 rounded-t-sm ${failedSignIns > 0 ? 'bg-error' : 'bg-base-300'}`}
						style={{
							height:
								failedSignIns > 0
									? `${Math.max(4, (failedSignIns / tallest) * 100)}%`
									: '2px',
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
					{t('signins.byDay.showTable')}
				</summary>
				<div
					role="region"
					aria-label={t('signins.byDay.title')}
					tabIndex={0}
					className="max-h-64 overflow-y-auto px-4 pb-2"
				>
					<table className="table table-sm">
						<caption>{t('signins.byDay.title')}</caption>
						<thead>
							<tr>
								<th>{t('signins.byDay.day')}</th>
								<th>{t('signins.byDay.signIns')}</th>
								<th>{t('signins.byDay.failed')}</th>
								<th>{t('signins.byDay.sessionReuse')}</th>
							</tr>
						</thead>
						<tbody>
							{[...days].reverse().map((entry) => (
								<tr key={entry.day}>
									<td>{formatDate(entry.day, i18n.language)}</td>
									<td>{number(entry.signIns)}</td>
									<td>{number(entry.failedSignIns)}</td>
									<td>{number(entry.sessionReuse)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</figure>
	);
}
