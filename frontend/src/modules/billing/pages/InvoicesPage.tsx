import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AnalyticsCard, ModulePage, Table, TipCard } from '@global-components';
import type { AnalyticsItem, TableColumn } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { useCan, useCurrentWorkspace } from '@modules/auth';
import { formatDate, formatNumber } from '@utils/format';
import { INVOICE_STATUSES, type InvoiceSummary } from '../api';
import { GenerateInvoiceDialog } from '../components/GenerateInvoiceDialog';
import { InvoiceDialog } from '../components/InvoiceDialog';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';
import { useExportInvoices, useInvoices, type InvoiceStatusFilter } from '../hooks/useInvoices';

// Company-wide invoices register: search, status filter, summary metrics, invoice generation,
// inspection/issuance dialog, and CSV export (billing.export).
export function InvoicesPage() {
	const { t, i18n } = useTranslation('billing');
	const companyPath = useCompanyPath();
	const company = useCurrentWorkspace()?.name ?? '';
	const can = useCan();
	const {
		invoices,
		total,
		summary,
		isPending,
		invoicesError,
		isFetching,
		retryInvoices,
		search,
		setSearch,
		status,
		setStatus,
		page,
		setPage,
		pageSize,
		setPageSize,
	} = useInvoices();
	const { exportInvoices, isExporting } = useExportInvoices();
	const [generating, setGenerating] = useState(false);
	const [openId, setOpenId] = useState<string | null>(null);

	const canExport = can('billing.export');
	const canCreate = can('billing.create_invoice');
	const count = (value?: number) => formatNumber(value, i18n.language);

	let emptyMessage = t('invoices.page.empty');
	if (isPending) emptyMessage = t('invoices.loading');
	else if (search.trim() || status) emptyMessage = t('invoices.page.noMatch');

	const stats: AnalyticsItem[] = [
		{
			label: t('invoices.stats.total'),
			value: count(summary?.total),
			description: t('invoices.stats.totalNote'),
		},
		{
			label: t('invoices.stats.drafts'),
			value: count(summary?.draft),
			description: t('invoices.stats.draftsNote'),
		},
		{
			label: t('invoices.stats.issued'),
			value: count(summary?.issued),
			description: t('invoices.stats.issuedNote'),
		},
		{
			label: t('invoices.stats.totalFees'),
			value: summary?.totalDeliveryFees ?? '—',
			description: t('invoices.stats.totalFeesNote'),
		},
	];

	const columns: TableColumn<InvoiceSummary>[] = [
		{
			key: 'number',
			header: t('invoices.number'),
			className: 'whitespace-nowrap',
			cell: (invoice) => (
				<button
					type="button"
					className="link link-hover font-medium tabular-nums"
					dir="ltr"
					onClick={() => setOpenId(invoice.id)}
				>
					{invoice.invoiceNumber}
				</button>
			),
		},
		{
			key: 'merchant',
			header: t('invoices.merchant'),
			cell: (invoice) => (
				<div>
					<Link
						to={companyPath(`clients/${invoice.clientId}`)}
						className="link link-hover font-medium"
					>
						<bdi>{invoice.clientName}</bdi>
					</Link>
					{invoice.clientCode && (
						<p className="text-xs text-[var(--color-slate)]" dir="ltr">
							{invoice.clientCode}
						</p>
					)}
				</div>
			),
		},
		{
			key: 'period',
			header: t('invoices.period'),
			className: 'whitespace-nowrap',
			cell: (invoice) =>
				`${formatDate(invoice.periodStart, i18n.language)} – ${formatDate(invoice.periodEnd, i18n.language)}`,
		},
		{
			key: 'status',
			header: t('invoices.statusColumn'),
			cell: (invoice) => <InvoiceStatusBadge status={invoice.status} />,
		},
		{
			key: 'deliveries',
			header: t('invoices.deliveries'),
			className: 'text-end tabular-nums',
			cell: (invoice) => (
				<span dir="ltr">{formatNumber(invoice.totalDeliveries, i18n.language)}</span>
			),
		},
		{
			key: 'amount',
			header: t('invoices.amount'),
			className: 'text-end whitespace-nowrap font-medium tabular-nums',
			cell: (invoice) => <span dir="ltr">{invoice.netAmountDue}</span>,
		},
	];

	return (
		<div className="flex flex-col gap-6">
			<ModulePage
				title={t('invoices.page.title')}
				description={t('invoices.page.description', { company })}
				actions={
					(canExport || canCreate) && (
						<div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
							{canExport && (
								<button
									type="button"
									className="btn border-0 bg-base-200"
									disabled={isExporting}
									onClick={() => exportInvoices({ status, search })}
								>
									{isExporting && (
										<span
											className="loading loading-spinner loading-xs"
											aria-hidden="true"
										/>
									)}
									{isExporting
										? t('invoices.export.exporting')
										: t('invoices.export.action')}
								</button>
							)}
							{canCreate && (
								<button
									type="button"
									className="btn btn-primary"
									onClick={() => setGenerating(true)}
								>
									{t('invoices.generate.open')}
								</button>
							)}
						</div>
					)
				}
			/>

			<AnalyticsCard items={stats} />

			<section aria-labelledby="company-invoices-title" className="flex flex-col gap-4">
				<div>
					<h2 id="company-invoices-title" className="font-semibold">
						{t('invoices.page.tableTitle')}
					</h2>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{t('invoices.page.tableDescription')}
					</p>
				</div>

				{invoicesError && (
					<div role="alert" className="alert alert-error alert-soft">
						<p>{t('invoices.loadFailed')}</p>
						<button
							type="button"
							className="btn btn-sm border-0 bg-base-200"
							disabled={isFetching}
							onClick={() => void retryInvoices()}
						>
							{isFetching ? t('invoices.retrying') : t('invoices.retry')}
						</button>
					</div>
				)}

				<Table
					caption={t('invoices.page.tableTitle')}
					columns={columns}
					rows={invoices}
					getRowKey={(invoice) => invoice.id}
					search={{
						value: search,
						onChange: setSearch,
						placeholder: t('invoices.page.searchPlaceholder'),
					}}
					filter={{
						label: t('invoices.statusColumn'),
						value: status,
						onChange: (value) => setStatus(value as InvoiceStatusFilter),
						options: [
							{ value: '', label: t('invoices.page.allStatuses') },
							...INVOICE_STATUSES.map((value) => ({
								value,
								label: t(`invoices.status.${value}`),
							})),
						],
					}}
					pagination={{
						page,
						pageSize,
						total,
						onPageChange: setPage,
						onPageSizeChange: setPageSize,
					}}
					emptyMessage={emptyMessage}
				/>
			</section>

			<TipCard
				title={t('invoices.page.tipTitle')}
				description={t('invoices.page.tipDescription')}
			/>

			{generating && <GenerateInvoiceDialog open onClose={() => setGenerating(false)} />}
			{openId && <InvoiceDialog invoiceId={openId} open onClose={() => setOpenId(null)} />}
		</div>
	);
}
