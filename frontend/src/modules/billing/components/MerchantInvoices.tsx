import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, type TableColumn } from '@global-components';
import { formatDate } from '@utils/format';
import type { InvoiceSummary } from '../api';
import { useMerchantInvoices } from '../hooks/useMerchantInvoices';
import { GenerateInvoiceDialog } from './GenerateInvoiceDialog';
import { InvoiceDialog } from './InvoiceDialog';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';

// A merchant's invoices on its details page (billing.create_invoice): newest first, each opening its parcel lines, and
// a button to bill a new period. An invoice lists delivery fees only, and fees are already taken from the balance at
// the COD handover, so an invoice is a statement and never moves money.
export function MerchantInvoices({
	clientId,
	businessName,
}: {
	clientId: string;
	businessName: string;
}) {
	const { t, i18n } = useTranslation('billing');
	const {
		invoices,
		total,
		isPending,
		invoicesError,
		isFetching,
		retryInvoices,
		page,
		setPage,
		pageSize,
		setPageSize,
	} = useMerchantInvoices(clientId);
	const [generating, setGenerating] = useState(false);
	const [openId, setOpenId] = useState<string | null>(null);

	const columns: TableColumn<InvoiceSummary>[] = [
		{
			key: 'number',
			header: t('invoices.number'),
			className: 'whitespace-nowrap',
			cell: (invoice) => (
				<button
					type="button"
					className="link link-hover font-medium"
					dir="ltr"
					onClick={() => setOpenId(invoice.id)}
				>
					{invoice.invoiceNumber}
				</button>
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
			className: 'text-end',
			cell: (invoice) => <span dir="ltr">{invoice.totalDeliveries}</span>,
		},
		{
			key: 'amount',
			header: t('invoices.amount'),
			className: 'text-end whitespace-nowrap font-medium',
			cell: (invoice) => <span dir="ltr">{invoice.netAmountDue}</span>,
		},
	];

	return (
		<section
			aria-labelledby="client-invoices-title"
			className="flex flex-col gap-4 rounded-box border border-base-300 p-4 md:p-8"
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 id="client-invoices-title" className="text-lg font-semibold">
						{t('invoices.title')}
					</h2>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{t('invoices.description')}
					</p>
				</div>
				<button
					type="button"
					className="btn btn-neutral shrink-0"
					onClick={() => setGenerating(true)}
				>
					{t('invoices.generate.open')}
				</button>
			</div>
			{invoicesError ? (
				<div role="alert" className="flex flex-col items-start gap-3">
					<p className="text-sm text-error">{t('invoices.loadFailed')}</p>
					<button
						type="button"
						className="btn btn-sm border-0 bg-base-200"
						disabled={isFetching}
						onClick={() => void retryInvoices()}
					>
						{isFetching ? t('invoices.retrying') : t('invoices.retry')}
					</button>
				</div>
			) : isPending ? (
				<span className="loading loading-spinner" aria-label={t('invoices.loading')} />
			) : (
				<Table
					caption={t('invoices.title')}
					columns={columns}
					rows={invoices}
					getRowKey={(invoice) => invoice.id}
					pagination={{
						page,
						pageSize,
						total,
						onPageChange: setPage,
						onPageSizeChange: setPageSize,
					}}
					emptyMessage={t('invoices.empty')}
				/>
			)}
			{generating && (
				<GenerateInvoiceDialog
					client={{ id: clientId, businessName }}
					open
					onClose={() => setGenerating(false)}
				/>
			)}
			{openId && <InvoiceDialog invoiceId={openId} open onClose={() => setOpenId(null)} />}
		</section>
	);
}
