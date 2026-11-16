import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnalyticsCard, Button, ModulePage } from '@global-components';
import { formatNumber } from '@utils/format';
import { DEFAULT_RANGE, isForbidden, type InsightsRange } from '../api';
import { CountList } from '../components/CountList';
import { DayBars } from '../components/DayBars';
import { RangeSelect } from '../components/RangeSelect';
import { useInsights } from '../hooks/useInsights';

// A translated name from another namespace, or the key made readable when none exists yet.
function nameOf(names: Record<string, string>, key: string): string {
	return names[key] ?? key.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

// How active the company has been and what it changed, as counts. Needs admin.audit_logs, like the audit trail.
export function InsightsPage() {
	const { t, i18n } = useTranslation('insights');
	const { t: audit } = useTranslation('audit');
	const [range, setRange] = useState<InsightsRange>(DEFAULT_RANGE);
	const { data, isPending, error, refetch, isFetching } = useInsights(range);
	const number = (value: number) => formatNumber(value, i18n.language);
	const header = <ModulePage title={t('pageTitle')} description={t('pageDescription')} />;

	// Opened by link without admin.audit_logs: say so plainly instead of showing an error.
	if (isForbidden(error)) {
		return (
			<div className="flex flex-col gap-4">
				{header}
				<div className="rounded-box border border-base-300 bg-base-200 px-6 py-12 text-center">
					<p className="font-medium">{t('noAccess')}</p>
					<p className="mt-1 text-xs text-[var(--color-slate)]">{t('noAccessHint')}</p>
				</div>
			</div>
		);
	}

	if (!data) {
		return (
			<div className="flex flex-col gap-4">
				{header}
				{isPending ? (
					<p className="flex items-center justify-center gap-2 py-12 text-[var(--color-slate)]">
						<span className="loading loading-spinner loading-sm" />
						{t('loading')}
					</p>
				) : (
					<div
						role="alert"
						className="rounded-box border border-base-300 bg-base-200 px-6 py-12 text-center"
					>
						<p className="font-medium">{t('loadFailed')}</p>
						<Button
							className="mt-4"
							onClick={() => void refetch()}
							disabled={isFetching}
						>
							{t('retry')}
						</Button>
					</div>
				)}
			</div>
		);
	}

	const roles = audit('roles', { returnObjects: true }) as Record<string, string>;
	const modules = audit('modules', { returnObjects: true }) as Record<string, string>;

	return (
		<div className="flex flex-col gap-4">
			{header}
			<div className="flex flex-wrap items-end gap-2">
				<RangeSelect value={range} onChange={setRange} />
			</div>
			<AnalyticsCard
				items={[
					{
						label: t('cards.activeMembers'),
						value: t('cards.activeOf', {
							active: number(data.members.active),
							total: number(data.members.total),
						}),
						description: t('cards.activeHint'),
					},
					{
						label: t('cards.visits'),
						value: number(data.visits),
						description: t('cards.visitsHint'),
					},
					{ label: t('cards.changes'), value: number(data.changes.total) },
				]}
			/>
			<AnalyticsCard
				items={[
					{
						label: t('cards.passwordResets'),
						value: number(data.security.passwordResets),
					},
					{
						label: t('cards.switchedOff'),
						value: number(data.security.accountsSwitchedOff),
					},
					{ label: t('cards.roleChanges'), value: number(data.security.roleChanges) },
					{ label: t('cards.denied'), value: number(data.security.deniedAttempts) },
				]}
			/>
			{data.hasHistory ? (
				<section className="flex flex-col gap-2">
					<h2 className="text-sm font-medium">{t('byDay.title')}</h2>
					<DayBars days={data.activeByDay} />
				</section>
			) : (
				<p className="rounded-box border border-base-300 bg-base-200 px-6 py-8 text-center text-sm text-[var(--color-slate)]">
					{t('noHistory')}
				</p>
			)}
			<div className="grid gap-4 md:grid-cols-2">
				<CountList
					title={t('byRole.title')}
					empty={t('byRole.empty')}
					items={data.activeByRole.map((row) => ({
						key: row.roleCode,
						label: roles[row.roleCode] ?? row.roleName,
						count: row.members,
					}))}
				/>
				<CountList
					title={t('byModule.title')}
					empty={t('byModule.empty')}
					items={data.changes.byModule.map((row) => ({
						key: row.module,
						label: nameOf(modules, row.module),
						count: row.count,
					}))}
				/>
			</div>
		</div>
	);
}
