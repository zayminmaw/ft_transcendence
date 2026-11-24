import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Input,
	ModulePage,
	Select,
	Table,
	TipCard,
	useToast,
	type TableColumn,
} from '@global-components';
import { useDriverChoices } from '@modules/drivers';
import { formatDate } from '@utils/format';
import type { WaitingParcel } from '../api';
import { useCashHandover, useWaitingCash } from '../hooks/useCashHandover';
import { CASH_AMOUNT_PATTERN, HANDOVER_REFERENCE_PATTERN, handoverErrorKey } from '../utils';

// /cash-handover: the cashier counts the cash a driver hands in and records it against the driver's delivered parcels
// (billing.reconcile_cod). The cash must match the parcels' COD exactly; the page never fills the count in, so it is a
// real count. Recording it credits each merchant and clears their pending COD.
export function CashHandoverPage() {
	const { t, i18n } = useTranslation('billing');
	const { toast } = useToast();
	const { driverChoices, isChoicesPending } = useDriverChoices();
	const [driverId, setDriverId] = useState('');
	const [fieldError, setFieldError] = useState<'cash' | 'reference' | null>(null);
	const { waiting, isWaitingPending } = useWaitingCash(driverId);
	const { recordHandover, isRecording, handoverError, resetHandover } = useCashHandover();

	const parcels = waiting?.parcels ?? [];
	const driver = driverChoices.find((choice) => choice.id === driverId);

	const chooseDriver = (id: string) => {
		setDriverId(id);
		setFieldError(null);
		resetHandover();
	};

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!driver || parcels.length === 0) return;
		const form = event.currentTarget;
		const data = new FormData(form);
		const cash = String(data.get('cash') ?? '').trim();
		const reference = String(data.get('reference') ?? '').trim();
		// Caught here so a typo doesn't cost a request; the server checks the same shapes again.
		if (!CASH_AMOUNT_PATTERN.test(cash)) return setFieldError('cash');
		if (!HANDOVER_REFERENCE_PATTERN.test(reference)) return setFieldError('reference');
		setFieldError(null);
		recordHandover(
			{
				driverId: driver.id,
				settlementReference: reference,
				totalCashDropped: cash,
				parcelIds: parcels.map((parcel) => parcel.id),
			},
			{
				onSuccess: (handover) => {
					form.reset();
					toast({
						variant: 'success',
						title: handover.repeated
							? t('cashHandover.repeated', { reference: handover.reference })
							: t('cashHandover.recorded', {
									amount: handover.totalCashDropped,
									name: driver.name,
								}),
					});
				},
			},
		);
	};

	const columns: TableColumn<WaitingParcel>[] = [
		{
			key: 'tracking',
			header: t('cashHandover.parcel'),
			className: 'font-medium',
			cell: (parcel) => <span dir="ltr">{parcel.trackingNumber}</span>,
		},
		{
			key: 'delivered',
			header: t('cashHandover.deliveredAt'),
			className: 'whitespace-nowrap',
			cell: (parcel) =>
				parcel.deliveredAt
					? formatDate(parcel.deliveredAt, i18n.language, {
							dateStyle: 'medium',
							timeStyle: 'short',
						})
					: '—',
		},
		{
			key: 'cod',
			header: t('cashHandover.cod'),
			className: 'text-end whitespace-nowrap',
			cell: (parcel) => <span dir="ltr">{parcel.codAmount}</span>,
		},
	];

	const errorKey = handoverError ? handoverErrorKey(handoverError) : null;

	return (
		<div className="flex flex-col gap-6">
			<ModulePage
				title={t('cashHandover.title')}
				description={t('cashHandover.description')}
			/>
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<div className="flex flex-col gap-6 rounded-box border border-base-300 p-4 md:p-8">
					<Select
						label={t('cashHandover.driver')}
						value={driverId}
						onChange={(event) => chooseDriver(event.target.value)}
						disabled={isChoicesPending}
						options={[
							{ value: '', label: t('cashHandover.driverPlaceholder') },
							...driverChoices.map((choice) => ({
								value: choice.id,
								label: `${choice.name} · ${choice.employeeCode}`,
							})),
						]}
					/>
					{driverId !== '' &&
						(isWaitingPending ? (
							<span
								className="loading loading-spinner"
								aria-label={t('cashHandover.loading')}
							/>
						) : (
							<>
								<Table
									caption={t('cashHandover.waiting')}
									columns={columns}
									rows={parcels}
									getRowKey={(parcel) => parcel.id}
									emptyMessage={t('cashHandover.empty')}
								/>
								{parcels.length > 0 && (
									<form
										onSubmit={submit}
										className="flex flex-col gap-4"
										noValidate
									>
										<p className="text-lg font-semibold">
											{t('cashHandover.expected')}{' '}
											<span dir="ltr">{waiting?.expectedTotal}</span>
										</p>
										<Input
											label={t('cashHandover.cash')}
											name="cash"
											required
											inputMode="decimal"
											dir="ltr"
											autoComplete="off"
											error={
												fieldError === 'cash'
													? t('cashHandover.errors.cash')
													: undefined
											}
										/>
										<Input
											label={t('cashHandover.reference')}
											name="reference"
											required
											dir="ltr"
											autoComplete="off"
											error={
												fieldError === 'reference'
													? t('cashHandover.errors.reference')
													: undefined
											}
										/>
										{handoverError && (
											<p
												role="alert"
												className="alert alert-error alert-soft text-sm"
											>
												{errorKey ? t(errorKey) : handoverError.message}
											</p>
										)}
										<div>
											<button
												type="submit"
												className="btn btn-neutral"
												disabled={isRecording}
											>
												{t('cashHandover.submit')}
											</button>
										</div>
									</form>
								)}
							</>
						))}
				</div>
				<TipCard
					title={t('cashHandover.tipTitle')}
					description={t('cashHandover.tipDescription')}
				/>
			</div>
		</div>
	);
}
