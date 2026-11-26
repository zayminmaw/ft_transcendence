import { useTranslation } from 'react-i18next';
import { Dialog, Table, type TableColumn } from '@global-components';
import { formatDate } from '@utils/format';
import type { InvoiceLine } from '../api';
import { useInvoice } from '../hooks/useInvoice';

// One invoice with the parcels it bills: the period, the dates, the total and a line per parcel. Read only.
export function InvoiceDialog({
	invoiceId,
	open,
	onClose,
}: {
	invoiceId: string;
	open: boolean;
	onClose: () => void;
}) {
	const { t, i18n } = useTranslation('billing');
	const { invoice, isPending, invoiceError, isFetching, retryInvoice } = useInvoice(invoiceId);

	const columns: TableColumn<InvoiceLine>[] = [
		{
			key: 'tracking',
			header: t('invoices.detail.parcel'),
			cell: (line) => <span dir="ltr">{line.trackingNumber}</span>,
		},
		{
			key: 'fee',
			header: t('invoices.detail.fee'),
			className: 'text-end whitespace-nowrap',
			cell: (line) => <span dir="ltr">{line.deliveryFee}</span>,
		},
	];
	const day = (value: string) => formatDate(value, i18n.language);

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title={invoice ? invoice.invoiceNumber : t('invoices.detail.title')}
			description={
				invoice
					? `${t(`invoices.status.${invoice.status}`)} · ${day(invoice.periodStart)} – ${day(invoice.periodEnd)}`
					: undefined
			}
			actions={
				<button type="button" className="btn border-0 bg-base-200" onClick={onClose}>
					{t('invoices.detail.close')}
				</button>
			}
		>
			{invoiceError ? (
				<div role="alert" className="flex flex-col items-start gap-3">
					<p className="text-sm text-error">{t('invoices.detail.loadFailed')}</p>
					<button
						type="button"
						className="btn btn-sm border-0 bg-base-200"
						disabled={isFetching}
						onClick={() => void retryInvoice()}
					>
						{isFetching ? t('invoices.retrying') : t('invoices.retry')}
					</button>
				</div>
			) : isPending || !invoice ? (
				<span
					className="loading loading-spinner"
					aria-label={t('invoices.detail.loading')}
				/>
			) : (
				<>
					<dl className="grid grid-cols-2 gap-4 text-sm">
						<div>
							<dt className="text-[var(--color-slate)]">
								{t('invoices.detail.issued')}
							</dt>
							<dd>{day(invoice.issueDate)}</dd>
						</div>
						<div>
							<dt className="text-[var(--color-slate)]">
								{t('invoices.detail.due')}
							</dt>
							<dd>{day(invoice.dueDate)}</dd>
						</div>
						<div>
							<dt className="text-[var(--color-slate)]">
								{t('invoices.detail.deliveries')}
							</dt>
							<dd dir="ltr">{invoice.totalDeliveries}</dd>
						</div>
						<div>
							<dt className="text-[var(--color-slate)]">
								{t('invoices.detail.total')}
							</dt>
							<dd dir="ltr" className="font-semibold">
								{invoice.netAmountDue}
							</dd>
						</div>
					</dl>
					{invoice.notes && (
						<p className="whitespace-pre-line text-sm">{invoice.notes}</p>
					)}
					<div className="max-h-64 overflow-y-auto">
						<Table
							caption={t('invoices.detail.lines')}
							columns={columns}
							rows={invoice.items}
							getRowKey={(line) => line.parcelId}
						/>
					</div>
				</>
			)}
		</Dialog>
	);
}
