import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Input, Textarea, useToast } from '@global-components';
import { useCreateInvoice } from '../hooks/useCreateInvoice';
import { INVOICE_NOTES_MAX, invoiceErrorKey } from '../utils';

// Finance bills a merchant for the delivery fees of the parcels delivered between two days (billing.create_invoice).
// The days start empty so the period is always chosen. The page mounts it fresh each time it opens.
export function GenerateInvoiceDialog({
	client,
	open,
	onClose,
}: {
	client: { id: string; businessName: string };
	open: boolean;
	onClose: () => void;
}) {
	const { t } = useTranslation('billing');
	const { toast } = useToast();
	const { createInvoice, isCreating, createError, resetCreate } = useCreateInvoice();
	const [fieldError, setFieldError] = useState<'periodStart' | 'periodEnd' | 'order' | null>(
		null,
	);
	const close = () => {
		resetCreate();
		setFieldError(null);
		onClose();
	};

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const periodStart = String(form.get('periodStart') ?? '');
		const periodEnd = String(form.get('periodEnd') ?? '');
		const notes = String(form.get('notes') ?? '').trim();
		// Caught here so a slip doesn't cost a request; the server checks the same rules again. A day is
		// 'YYYY-MM-DD', so comparing the strings compares the days.
		if (!periodStart) return setFieldError('periodStart');
		if (!periodEnd) return setFieldError('periodEnd');
		if (periodStart > periodEnd) return setFieldError('order');
		setFieldError(null);
		createInvoice(
			{ clientId: client.id, periodStart, periodEnd, ...(notes ? { notes } : {}) },
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
			title={t('invoices.generate.title', { name: client.businessName })}
			description={t('invoices.generate.description')}
			onSubmit={submit}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={close}>
						{t('invoices.generate.cancel')}
					</button>
					<button type="submit" className="btn btn-neutral" disabled={isCreating}>
						{t('invoices.generate.submit')}
					</button>
				</>
			}
		>
			<Input
				label={t('invoices.generate.periodStart')}
				name="periodStart"
				type="date"
				required
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
