import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnalyticsCard, Button, ModulePage, SelectFilter } from '@global-components';
import { formatNumber } from '@utils/format';
import { SIGNINS_DEFAULT_RANGE, SIGNINS_RANGES, type SigninsRange } from '../api';
import { SigninsByDay } from '../components/SigninsByDay';
import { useSignins } from '../hooks/useSignins';

// How many people signed in across all companies and how many attempts failed, as counts. Platform administrators
// only (the route sits under the platform layout). It never shows who signed in or which company they belong to.
export function SigninsPage() {
	const { t, i18n } = useTranslation('platform');
	const [range, setRange] = useState<SigninsRange>(SIGNINS_DEFAULT_RANGE);
	const { data, isPending, isPlaceholderData, refetch, isFetching } = useSignins(range);
	const number = (value: number) => formatNumber(value, i18n.language);
	const header = <ModulePage title={t('signins.title')} description={t('signins.description')} />;

	if (!data) {
		return (
			<div className="flex flex-col gap-4">
				{header}
				{isPending ? (
					<p className="flex items-center justify-center gap-2 py-12 text-[var(--color-slate)]">
						<span className="loading loading-spinner loading-sm" />
						{t('signins.loading')}
					</p>
				) : (
					<div
						role="alert"
						className="rounded-box border border-base-300 bg-base-200 px-6 py-12 text-center"
					>
						<p className="font-medium">{t('signins.loadFailed')}</p>
						<Button
							className="mt-4"
							onClick={() => void refetch()}
							disabled={isFetching}
						>
							{t('signins.retry')}
						</Button>
					</div>
				)}
			</div>
		);
	}

	const { totals } = data;
	return (
		<div className="flex flex-col gap-4">
			{header}
			<div className="flex flex-wrap items-end gap-2">
				<SelectFilter
					label={t('signins.range.label')}
					value={String(range)}
					onChange={(next) => setRange(Number(next) as SigninsRange)}
					options={SIGNINS_RANGES.map((days) => ({
						value: String(days),
						label: t(`signins.range.last${days}`),
					}))}
				/>
				{isPlaceholderData && (
					<p
						role="status"
						className="flex items-center gap-2 pb-2 text-sm text-[var(--color-slate)]"
					>
						<span className="loading loading-spinner loading-xs" />
						{t('signins.updating')}
					</p>
				)}
			</div>
			{/* The old period's numbers stay on screen while the new one loads, so they are dimmed and marked busy. */}
			<div
				aria-busy={isPlaceholderData}
				className={`flex flex-col gap-4 transition-opacity ${isPlaceholderData ? 'opacity-50' : ''}`}
			>
				<AnalyticsCard
					items={[
						{
							label: t('signins.cards.signIns'),
							value: number(totals.signIns),
							description: t('signins.cards.signInsHint'),
						},
						{
							label: t('signins.cards.failed'),
							value: number(totals.failedSignIns),
							description: t('signins.cards.failedHint'),
						},
						{
							label: t('signins.cards.failureRate'),
							value: formatNumber(totals.failureRate / 100, i18n.language, {
								style: 'percent',
								maximumFractionDigits: 1,
							}),
							description: t('signins.cards.failureRateHint'),
						},
						{
							label: t('signins.cards.sessionReuse'),
							value: number(totals.sessionReuse),
							description: t('signins.cards.sessionReuseHint'),
						},
					]}
				/>
				{totals.sessionReuse > 0 && (
					<p
						role="status"
						className="rounded-box border border-warning bg-base-200 px-4 py-3 text-sm"
					>
						{t('signins.reuseWarning')}
					</p>
				)}
				<section className="flex flex-col gap-2">
					<h2 className="text-sm font-medium">{t('signins.byDay.title')}</h2>
					<SigninsByDay days={data.days} />
				</section>
				<p className="text-xs text-[var(--color-slate)]">{t('signins.countsOnly')}</p>
			</div>
		</div>
	);
}
