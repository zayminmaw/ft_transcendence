import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { formatNumber } from '@utils/format';
import type { DashboardParcel, DashboardParcelList, DashboardParcelStatus } from '../api';
import { WidgetFrame } from './WidgetFrame';

const PIPELINE_STEPS: {
	status: DashboardParcelStatus;
	barClass: string;
	dotClass: string;
}[] = [
	{ status: 'pickup_scheduled', barClass: 'bg-base-300', dotClass: 'bg-base-300' },
	{
		status: 'picked_up',
		barClass: 'bg-[var(--color-slate)]',
		dotClass: 'bg-[var(--color-slate)]',
	},
	{ status: 'in_hub_sorted', barClass: 'bg-primary', dotClass: 'bg-primary' },
	{ status: 'out_for_delivery', barClass: 'bg-info', dotClass: 'bg-info' },
	{ status: 'delivered', barClass: 'bg-success', dotClass: 'bg-success' },
	{ status: 'failed_attempt', barClass: 'bg-warning', dotClass: 'bg-warning' },
	{ status: 'returned_to_sender', barClass: 'bg-error', dotClass: 'bg-error' },
];

const ASSIGNABLE = new Set<DashboardParcelStatus>(['in_hub_sorted', 'failed_attempt']);

function statusBadgeClass(status: DashboardParcelStatus): string {
	switch (status) {
		case 'delivered':
			return 'badge-success badge-soft';
		case 'out_for_delivery':
			return 'badge-info badge-soft';
		case 'in_hub_sorted':
			return 'badge-primary';
		case 'failed_attempt':
			return 'badge-warning badge-soft';
		case 'returned_to_sender':
			return 'badge-error badge-soft';
		default:
			return 'badge-ghost';
	}
}

type ParcelsWidgetProps = {
	data: DashboardParcelList | undefined;
	isPending: boolean;
	isError: boolean;
	onRetry: () => void;
	assignedOnly: boolean;
	canDispatch: boolean;
	canMarkDelivered: boolean;
	className?: string;
};

export function ParcelsWidget({
	data,
	isPending,
	isError,
	onRetry,
	assignedOnly,
	canDispatch,
	canMarkDelivered,
	className = '',
}: ParcelsWidgetProps) {
	const { t, i18n } = useTranslation('dashboard');
	const { t: tParcels } = useTranslation('parcels');
	const companyPath = useCompanyPath();
	const number = (value: number) => formatNumber(value, i18n.language);

	const statuses = data?.counts.statuses;
	const totalParcels = statuses
		? PIPELINE_STEPS.reduce((sum, step) => sum + (statuses[step.status] ?? 0), 0)
		: 0;
	const recentParcels: DashboardParcel[] = (data?.items ?? []).slice(0, 6);

	return (
		<WidgetFrame
			title={assignedOnly ? t('parcels.myRunTitle') : t('parcels.title')}
			subtitle={assignedOnly ? t('parcels.myRunSubtitle') : t('parcels.subtitle')}
			actionTo={companyPath('parcels')}
			actionLabel={t('actions.viewAll')}
			actionContext={assignedOnly ? t('parcels.myRunTitle') : t('parcels.title')}
			badge={
				data && (
					<span className="badge badge-ghost badge-sm tabular-nums">
						{number(data.total)}
					</span>
				)
			}
			isPending={isPending}
			isError={isError}
			onRetry={onRetry}
			className={className}
		>
			{!assignedOnly && statuses && totalParcels > 0 && (
				<div className="mb-5">
					<div
						className="flex h-2.5 w-full overflow-hidden rounded-full bg-base-200"
						role="img"
						aria-label={t('parcels.pipelineSummary', { total: number(totalParcels) })}
					>
						{PIPELINE_STEPS.map(({ status, barClass }) => {
							const count = statuses[status] ?? 0;
							if (count === 0) return null;
							const widthPercent = (count / totalParcels) * 100;
							return (
								<div
									key={status}
									className={`${barClass} h-full transition-[width] duration-300`}
									style={{ width: `${widthPercent}%` }}
								/>
							);
						})}
					</div>
					<dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 @md:grid-cols-4 @2xl:grid-cols-7">
						{PIPELINE_STEPS.map(({ status, dotClass }) => (
							<div key={status} className="flex min-w-0 items-center gap-2">
								<span
									aria-hidden="true"
									className={`size-2 shrink-0 rounded-full ${dotClass}`}
								/>
								<dt className="truncate text-xs text-[var(--color-slate)]">
									{tParcels(`status.${status}`)}
								</dt>
								<dd className="ms-auto text-xs font-semibold tabular-nums text-base-content">
									{number(statuses[status] ?? 0)}
								</dd>
							</div>
						))}
					</dl>
				</div>
			)}

			{recentParcels.length === 0 ? (
				<div className="flex flex-1 flex-col items-center justify-center rounded-box bg-base-200 px-6 py-8 text-center">
					<p className="text-sm font-medium text-base-content">
						{assignedOnly ? t('parcels.myRunEmpty') : t('parcels.empty')}
					</p>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{assignedOnly ? t('parcels.myRunEmptyHint') : t('parcels.emptyHint')}
					</p>
				</div>
			) : (
				<div className="overflow-x-auto">
					<table className="table table-sm">
						<caption className="sr-only">
							{assignedOnly ? t('parcels.myRunTitle') : t('parcels.recentCaption')}
						</caption>
						<thead>
							<tr className="bg-base-200">
								<th
									scope="col"
									className="border-0 text-xs font-normal text-[var(--color-slate)]"
								>
									{t('parcels.columns.waybill')}
								</th>
								<th
									scope="col"
									className="border-0 text-xs font-normal text-[var(--color-slate)]"
								>
									{assignedOnly
										? t('parcels.columns.cod')
										: t('parcels.columns.merchant')}
								</th>
								<th
									scope="col"
									className="hidden border-0 text-xs font-normal text-[var(--color-slate)] @lg:table-cell"
								>
									{t('parcels.columns.zone')}
								</th>
								<th
									scope="col"
									className="border-0 text-xs font-normal text-[var(--color-slate)]"
								>
									{t('parcels.columns.status')}
								</th>
								<th
									scope="col"
									className="border-0 text-end text-xs font-normal text-[var(--color-slate)]"
								>
									{t('parcels.columns.action')}
								</th>
							</tr>
						</thead>
						<tbody>
							{recentParcels.map((parcel) => {
								const showAssign = canDispatch && ASSIGNABLE.has(parcel.status);
								const showDeliver =
									canMarkDelivered && parcel.status === 'out_for_delivery';
								return (
									<tr key={parcel.id}>
										<td className="border-b border-base-300 py-3">
											<Link
												to={companyPath(`parcels/${parcel.id}`)}
												className="link link-hover block font-medium"
											>
												<span className="font-mono text-xs tabular-nums">
													{parcel.trackingNumber}
												</span>
											</Link>
											<p className="truncate text-xs text-[var(--color-slate)]">
												<bdi>{parcel.recipientName}</bdi>
											</p>
										</td>
										<td className="border-b border-base-300 py-3 text-xs">
											{assignedOnly ? (
												<span className="font-medium tabular-nums">
													{parcel.codAmount}
												</span>
											) : (
												<span className="block max-w-[16ch] truncate">
													<bdi>{parcel.client.name}</bdi>
												</span>
											)}
										</td>
										<td className="hidden border-b border-base-300 py-3 text-xs text-[var(--color-slate)] @lg:table-cell">
											<span className="block max-w-[16ch] truncate">
												<bdi>{parcel.deliveryCityZone}</bdi>
											</span>
										</td>
										<td className="border-b border-base-300 py-3">
											<span
												className={`badge badge-sm whitespace-nowrap ${statusBadgeClass(parcel.status)}`}
											>
												{tParcels(`status.${parcel.status}`)}
											</span>
										</td>
										<td className="border-b border-base-300 py-3 text-end">
											{showDeliver ? (
												<Link
													to={companyPath(`parcels/${parcel.id}/deliver`)}
													className="btn btn-primary btn-sm"
												>
													{t('parcels.recordDelivery')}
												</Link>
											) : showAssign ? (
												<Link
													to={companyPath(
														`parcels/assign?parcel=${parcel.id}`,
													)}
													className="btn btn-sm border-0 bg-base-200"
												>
													{t('parcels.assign')}
												</Link>
											) : (
												<Link
													to={companyPath(`parcels/${parcel.id}`)}
													className="btn btn-ghost btn-sm"
												>
													{t('actions.open')}
													<span className="sr-only">
														{' '}
														{parcel.trackingNumber}
													</span>
												</Link>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</WidgetFrame>
	);
}
