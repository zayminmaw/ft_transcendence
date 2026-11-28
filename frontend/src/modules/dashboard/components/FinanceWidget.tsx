import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { formatNumber } from '@utils/format';
import type { DashboardCashDriver, DashboardClientList } from '../api';
import { WidgetFrame } from './WidgetFrame';

type FinanceWidgetProps = {
	cashDrivers: DashboardCashDriver[] | undefined;
	isCashPending: boolean;
	isCashError: boolean;
	onRetryCash: () => void;
	clients: DashboardClientList | undefined;
	isClientsPending: boolean;
	isClientsError: boolean;
	onRetryClients: () => void;
	canReconcileCod: boolean;
	canViewFinancials: boolean;
	className?: string;
};

export function FinanceWidget({
	cashDrivers,
	isCashPending,
	isCashError,
	onRetryCash,
	clients,
	isClientsPending,
	isClientsError,
	onRetryClients,
	canReconcileCod,
	canViewFinancials,
	className = '',
}: FinanceWidgetProps) {
	const { t, i18n } = useTranslation('dashboard');
	const companyPath = useCompanyPath();
	const number = (value: number) => formatNumber(value, i18n.language);

	const isPending = (canReconcileCod && isCashPending) || (canViewFinancials && isClientsPending);
	const isError = (canReconcileCod && isCashError) || (canViewFinancials && isClientsError);
	const handleRetry = () => {
		if (canReconcileCod) onRetryCash();
		if (canViewFinancials) onRetryClients();
	};

	const merchantRows = (clients?.items ?? []).slice(0, 5);
	const driverCount = cashDrivers?.length ?? 0;

	return (
		<WidgetFrame
			title={t('finance.title')}
			subtitle={t('finance.subtitle')}
			actionTo={canReconcileCod ? companyPath('cash-handover') : companyPath('clients')}
			actionLabel={canReconcileCod ? t('finance.openHandover') : t('actions.viewAll')}
			actionContext={t('finance.title')}
			isPending={isPending}
			isError={isError}
			onRetry={handleRetry}
			className={className}
		>
			<div className="flex flex-1 flex-col gap-5">
				{canReconcileCod && (
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-box bg-base-200 p-4">
						<div className="min-w-0">
							<p className="text-xs text-[var(--color-slate)]">
								{t('finance.codHandoverLabel')}
							</p>
							<p className="mt-0.5 text-sm font-semibold text-base-content">
								{t('finance.codDriversCount', { count: driverCount })}
							</p>
							<p className="mt-0.5 text-xs text-[var(--color-slate)]">
								{t('finance.codHint')}
							</p>
						</div>
						<Link
							to={companyPath('cash-handover')}
							className="btn btn-primary btn-sm shrink-0"
						>
							{t('finance.reconcileAction')}
						</Link>
					</div>
				)}

				{canViewFinancials && (
					<div className="min-w-0">
						<div className="mb-2 flex items-center justify-between gap-2">
							<h3 className="text-sm font-medium text-base-content">
								{t('finance.merchantBalances')}
							</h3>
							{clients && (
								<span className="text-xs tabular-nums text-[var(--color-slate)]">
									{t('finance.activeMerchants', {
										count: clients.counts.active,
										formatted: number(clients.counts.active),
									})}
								</span>
							)}
						</div>

						{merchantRows.length === 0 ? (
							<p className="rounded-box bg-base-200 px-4 py-6 text-center text-xs text-[var(--color-slate)]">
								{t('finance.noMerchants')}
							</p>
						) : (
							<div className="overflow-x-auto">
								<table className="table table-sm">
									<caption className="sr-only">
										{t('finance.merchantBalances')}
									</caption>
									<thead>
										<tr className="bg-base-200">
											<th
												scope="col"
												className="border-0 text-xs font-normal text-[var(--color-slate)]"
											>
												{t('finance.columns.merchant')}
											</th>
											<th
												scope="col"
												className="border-0 text-end text-xs font-normal text-[var(--color-slate)]"
											>
												{t('finance.columns.balance')}
											</th>
											<th
												scope="col"
												className="border-0 text-end text-xs font-normal text-[var(--color-slate)]"
											>
												{t('finance.columns.pendingCod')}
											</th>
										</tr>
									</thead>
									<tbody>
										{merchantRows.map((client) => (
											<tr key={client.id}>
												<td className="border-b border-base-300 py-3">
													<Link
														to={companyPath(`clients/${client.id}`)}
														className="link link-hover font-medium"
													>
														<bdi>{client.businessName}</bdi>
													</Link>
													<p className="text-xs text-[var(--color-slate)]">
														{client.clientCode}
													</p>
												</td>
												<td className="border-b border-base-300 py-3 text-end text-xs font-medium tabular-nums">
													{client.currentBalance ?? '0.00'}
												</td>
												<td className="border-b border-base-300 py-3 text-end text-xs tabular-nums text-[var(--color-slate)]">
													{client.pendingCodBalance ?? '0.00'}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				)}
			</div>
		</WidgetFrame>
	);
}
