import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Input, useToast } from '@global-components';
import { usePayout } from '../hooks/usePayout';
import { PAYOUT_AMOUNT_PATTERN, WIRE_REFERENCE_PATTERN, payoutErrorKey } from '../utils';

// Finance pays a merchant out of what it is owed (billing.adjust_balance). The amount starts as the whole balance,
// which also settles the merchant's issued invoices; a smaller amount leaves them open. The page mounts it fresh each
// time it opens, so the amount always starts from the current balance.
export function PayoutDialog({
	client,
	open,
	onClose,
}: {
	client: { id: string; businessName: string; balance: string };
	open: boolean;
	onClose: () => void;
}) {
	const { t } = useTranslation('billing');
	const { toast } = useToast();
	const { payMerchant, isPaying, payError, resetPay } = usePayout();
	const [fieldError, setFieldError] = useState<'amount' | 'wireReference' | null>(null);
	const close = () => {
		resetPay();
		setFieldError(null);
		onClose();
	};

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const amount = String(form.get('amount') ?? '').trim();
		const wireReference = String(form.get('wireReference') ?? '').trim();
		// Caught here so a typo doesn't cost a request; the server checks the same shapes again.
		if (!PAYOUT_AMOUNT_PATTERN.test(amount)) return setFieldError('amount');
		if (!WIRE_REFERENCE_PATTERN.test(wireReference)) return setFieldError('wireReference');
		setFieldError(null);
		payMerchant(
			{ clientId: client.id, amount, wireReference },
			{
				onSuccess: (payout) => {
					close();
					toast({
						variant: 'success',
						title: payout.repeated
							? t('payout.repeated', { reference: payout.wireReference })
							: t('payout.paid', {
									amount: payout.amount,
									name: client.businessName,
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
			title={t('payout.title', { name: client.businessName })}
			description={t('payout.description', { balance: client.balance })}
			onSubmit={submit}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={close}>
						{t('payout.cancel')}
					</button>
					<button type="submit" className="btn btn-neutral" disabled={isPaying}>
						{t('payout.submit')}
					</button>
				</>
			}
		>
			<Input
				label={t('payout.amount')}
				name="amount"
				required
				inputMode="decimal"
				dir="ltr"
				defaultValue={client.balance}
				error={fieldError === 'amount' ? t('payout.errors.amount') : undefined}
			/>
			<Input
				label={t('payout.wireReference')}
				name="wireReference"
				required
				dir="ltr"
				autoComplete="off"
				error={
					fieldError === 'wireReference' ? t('payout.errors.wireReference') : undefined
				}
			/>
			<p className="text-sm text-[var(--color-slate)]">{t('payout.referenceNote')}</p>
			{payError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(payoutErrorKey(payError))}
				</p>
			)}
		</Dialog>
	);
}
