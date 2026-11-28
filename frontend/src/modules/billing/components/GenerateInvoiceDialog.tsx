import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Input, Select, Textarea, useToast } from '@global-components';
import { useCreateInvoice } from '../hooks/useCreateInvoice';
import { useInvoiceClients } from '../hooks/useInvoices';
import { INVOICE_NOTES_MAX, invoiceErrorKey } from '../utils';

// Finance bills a merchant for the delivery fees of the parcels delivered between two days (billing.create_invoice).
// When opened from a merchant page, `client` is fixed; when opened from the company-wide invoices page, a merchant
// selector is shown. The days start empty so the period is always chosen. The page mounts it fresh each time it opens.
export function GenerateInvoiceDialog({
	client,
	open,
	onClose,
}: {
	client?: { id: string; businessName: string };
	open: boolean;
	onClose: () => void;
}) {
	const { t } = useTranslation('billing');
	const { toast } = useToast();
	const { createInvoice, isCreating, createError, resetCreate } = useCreateInvoice();
	const needsPicker = !client;
	const { clients, isClientsPending, clientsError, retryClients } = useInvoiceClients(
		open && needsPicker,
	);
	const [selectedClientId, setSelectedClientId] = useState(client?.id ?? '');
	const [fieldError, setFieldError] = useState<
		'merchant' | 'periodStart' | 'periodEnd' | 'order' | null
	>(null);

	const close = () => {
		resetCreate();
		setFieldError(null);
		onClose();
	};

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const clientId = client?.id ?? selectedClientId;
		const periodStart = String(form.get('periodStart') ?? '');
		const periodEnd = String(form.get('periodEnd') ?? '');
		const notes = String(form.get('notes') ?? '').trim();
		// Caught here so a slip doesn't cost a request; the server checks the same rules again. A day is
		// 'YYYY-MM-DD', so comparing the strings compares the days.
		if (!clientId) return setFieldError('merchant');
		if (!periodStart) return setFieldError('periodStart');
		if (!periodEnd) return setFieldError('periodEnd');
		if (periodStart > periodEnd) return setFieldError('order');
		setFieldError(null);
		createInvoice(
			{ clientId, periodStart, periodEnd, ...(notes ? { notes } : {}) },
			{
				onSuccess: (invoice) => {
					close();
					toast({
						variant: 'success',
						title: t('invoices.generate.created', {
							number: invoice.invoiceNumber,
							amount: invoice.netAmountDue,
						}),
					});
				},
			},
		);
	};

	return (
		<Dialog
			open={open}
			onClose={close}
			title={
				client
					? t('invoices.generate.title', { name: client.businessName })
					: t('invoices.generate.companyTitle')
			}
			description={t('invoices.generate.description')}
			onSubmit={submit}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={close}>
						{t('invoices.generate.cancel')}
					</button>
					<button
						type="submit"
						className="btn btn-neutral"
						disabled={isCreating || (needsPicker && isClientsPending)}
					>
						{t('invoices.generate.submit')}
					</button>
				</>
			}
		>
			{needsPicker && (
				<>
					<Select
						label={t('invoices.generate.merchant')}
						name="clientId"
						required
						autoFocus
						value={selectedClientId}
						disabled={isClientsPending}
						onChange={(event) => {
							setSelectedClientId(event.target.value);
							if (fieldError === 'merchant') setFieldError(null);
						}}
						error={
							fieldError === 'merchant' ? t('invoices.errors.merchant') : undefined
						}
						options={[
							{ value: '', label: t('invoices.generate.merchantPlaceholder') },
							...clients.map((item) => ({
								value: item.id,
								label: `${item.businessName} · ${item.clientCode}`,
							})),
						]}
					/>
					{clientsError && (
						<div role="alert" className="alert alert-error alert-soft text-sm">
							<p>{t('invoices.generate.merchantsLoadFailed')}</p>
							<button
								type="button"
								className="btn btn-sm"
								onClick={() => void retryClients()}
							>
								{t('invoices.retry')}
							</button>
						</div>
					)}
				</>
			)}
			<Input
				label={t('invoices.generate.periodStart')}
				name="periodStart"
				type="date"
				required
				autoFocus={!needsPicker}
				dir="ltr"
				error={fieldError === 'periodStart' ? t('invoices.errors.periodStart') : undefined}
			/>
			<Input
				label={t('invoices.generate.periodEnd')}
				name="periodEnd"
				type="date"
				required
				dir="ltr"
				error={
					fieldError === 'periodEnd'
						? t('invoices.errors.periodEnd')
						: fieldError === 'order'
							? t('invoices.errors.badPeriod')
							: undefined
				}
			/>
			<Textarea
				label={t('invoices.generate.notes')}
				name="notes"
				maxLength={INVOICE_NOTES_MAX}
			/>
			<p className="text-sm text-[var(--color-slate)]">{t('invoices.generate.note')}</p>
			{createError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(invoiceErrorKey(createError))}
				</p>
			)}
		</Dialog>
	);
}
