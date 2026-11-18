import { useTranslation } from 'react-i18next';
import { Table, type TableColumn } from '@global-components';
import { formatDate } from '@utils/format';
import type { LedgerEntry } from '../api';
import { useMerchantLedger } from '../hooks/useMerchantLedger';

// A merchant's ledger on its details page: every balance change, newest first, with the balance it left. A credit is
// money the courier owes the merchant, a debit lowers it.
export function MerchantLedger({ clientId }: { clientId: string }) {
	const { t, i18n } = useTranslation('billing');
	const { entries, total, isPending, page, setPage, pageSize, setPageSize } =
		useMerchantLedger(clientId);

	const columns: TableColumn<LedgerEntry>[] = [
		{
			key: 'date',
			header: t('ledger.date'),
			className: 'whitespace-nowrap',
			cell: (entry) =>
				formatDate(entry.createdAt, i18n.language, {
					dateStyle: 'medium',
					timeStyle: 'short',
				}),
		},
		{
			key: 'entry',
			header: t('ledger.entry'),
			cell: (entry) => (
				<div>
					<p className="font-medium">{t(`ledger.types.${entry.referenceType}`)}</p>
					<p className="text-xs text-[var(--color-slate)]">{entry.description}</p>
				</div>
			),
		},
		{
			key: 'amount',
			header: t('ledger.amount'),
			className: 'text-end whitespace-nowrap',
			cell: (entry) => (
				<span dir="ltr">
					{entry.entryType === 'credit' ? '+' : '−'}
					{entry.amount}
				</span>
			),
		},
		{
			key: 'balance',
			header: t('ledger.balanceAfter'),
			className: 'text-end whitespace-nowrap font-medium',
			cell: (entry) => <span dir="ltr">{entry.balanceAfter}</span>,
		},
	];

	return (
		<section
			aria-labelledby="client-ledger-title"
			className="flex flex-col gap-4 rounded-box border border-base-300 p-4 md:p-8"
		>
			<div>
				<h2 id="client-ledger-title" className="text-lg font-semibold">
					{t('ledger.title')}
				</h2>
				<p className="mt-1 text-xs text-[var(--color-slate)]">{t('ledger.description')}</p>
			</div>
			{isPending ? (
				<span className="loading loading-spinner" aria-label={t('ledger.loading')} />
			) : (
				<Table
					caption={t('ledger.title')}
					columns={columns}
					rows={entries}
					getRowKey={(entry) => entry.id}
					pagination={{
						page,
						pageSize,
						total,
						onPageChange: setPage,
						onPageSizeChange: setPageSize,
					}}
					emptyMessage={t('ledger.empty')}
				/>
			)}
		</section>
	);
}
