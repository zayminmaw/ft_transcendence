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
import { ApiError } from '@services/api-client';
import { formatDate } from '@utils/format';
import type { HandoverValues, WaitingParcel } from '../api';
import { MAX_HANDOVER_PARCELS, handoverTotal } from '../cash-handover';
import { useCashDrivers, useCashHandover, useWaitingCash } from '../hooks/useCashHandover';
import { CASH_AMOUNT_PATTERN, HANDOVER_REFERENCE_PATTERN, handoverErrorKey } from '../utils';

type Attempt = { values: HandoverValues; parcels: WaitingParcel[]; driverName: string };

// Keep a submitted handover separate from the live waiting list until its outcome is known. A lost response can
// remove its parcels from that list, but a retry must still send the original reference, amount and parcel IDs.
export function CashHandoverPage() {
	const { t, i18n } = useTranslation('billing');
	const { toast } = useToast();
	const { driverChoices, isChoicesPending, choicesError, retryChoices } = useCashDrivers();
	const [driverId, setDriverId] = useState('');
	const [fieldError, setFieldError] = useState<'cash' | 'reference' | null>(null);
	const [selection, setSelection] = useState<string[] | null>(null);
	const [cash, setCash] = useState('');
	const [reference, setReference] = useState('');
	const [attempt, setAttempt] = useState<Attempt | null>(null);
	const { waiting, isWaitingPending, waitingError, retryWaiting } = useWaitingCash(driverId);
	const { recordHandover, isRecording, handoverError, resetHandover } = useCashHandover();
	const parcels = attempt?.parcels ?? waiting?.parcels ?? [];
	const selectedIds = new Set(
		selection ?? parcels.slice(0, MAX_HANDOVER_PARCELS).map((parcel) => parcel.id),
	);
	const selected = attempt?.parcels ?? parcels.filter((parcel) => selectedIds.has(parcel.id));
	const driver = driverChoices.find((choice) => choice.id === driverId);
	const locked = attempt !== null;
	const canLoad = !attempt && driverId !== '';

	const chooseDriver = (id: string) => {
		if (locked || isRecording) return;
		setDriverId(id);
		setSelection(null);
		setCash('');
		setReference('');
		setFieldError(null);
		resetHandover();
	};

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isRecording || (!attempt && (!driver || waitingError || selected.length === 0))) return;
		if (!CASH_AMOUNT_PATTERN.test(cash.trim())) return setFieldError('cash');
		if (!HANDOVER_REFERENCE_PATTERN.test(reference.trim())) return setFieldError('reference');
		const submitted = attempt ?? {
			values: {
				driverId: driver!.id,
				settlementReference: reference.trim(),
				totalCashDropped: cash.trim(),
				parcelIds: selected.map((parcel) => parcel.id),
			},
			parcels: selected,
			driverName: driver!.name,
		};
		setAttempt(submitted);
		setFieldError(null);
		recordHandover(submitted.values, {
			onSuccess: (handover) => {
				setAttempt(null);
				setSelection(null);
				setCash('');
				setReference('');
				toast({
					variant: 'success',
					title: handover.repeated
						? t('cashHandover.repeated', { reference: handover.reference })
						: t('cashHandover.recorded', {
								amount: handover.totalCashDropped,
								name: submitted.driverName,
							}),
				});
			},
			onError: (error) => {
				// A 4xx is a definite refusal and can be corrected. Transport/5xx errors may follow a commit:
				// keep the frozen request and offer only its exact idempotent retry.
				if (error instanceof ApiError && error.status < 500) setAttempt(null);
			},
		});
	};

	const columns: TableColumn<WaitingParcel>[] = [
		{
			key: 'selected',
			header: t('cashHandover.include'),
			cell: (parcel) => (
				<input
					type="checkbox"
					className="checkbox checkbox-sm"
					aria-label={t('cashHandover.selectParcel', { tracking: parcel.trackingNumber })}
					checked={locked || selectedIds.has(parcel.id)}
					disabled={
						locked ||
						(!selectedIds.has(parcel.id) && selected.length >= MAX_HANDOVER_PARCELS)
					}
					onChange={(event) =>
						setSelection(
							event.target.checked
								? [...selected.map((item) => item.id), parcel.id]
								: selected
										.filter((item) => item.id !== parcel.id)
										.map((item) => item.id),
						)
					}
				/>
			),
		},
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
				<div className="flex min-w-0 flex-col gap-6 rounded-box border border-base-300 p-4 md:p-8">
					<Select
						label={t('cashHandover.driver')}
						value={driverId}
						onChange={(event) => chooseDriver(event.target.value)}
						disabled={isChoicesPending || locked}
						options={[
							{ value: '', label: t('cashHandover.driverPlaceholder') },
							...driverChoices.map((choice) => ({
								value: choice.id,
								label: choice.name + ' · ' + choice.employeeCode,
							})),
						]}
					/>
					{choicesError && !attempt && (
						<div role="alert" className="alert alert-error alert-soft">
							<p>{t('cashHandover.driversLoadFailed')}</p>
							<button
								type="button"
								className="btn btn-sm"
								onClick={() => void retryChoices()}
							>
								{t('cashHandover.retry')}
							</button>
						</div>
					)}
					{handoverError && (
						<p role="alert" className="alert alert-error alert-soft text-sm">
							{errorKey ? t(errorKey) : handoverError.message}
						</p>
					)}
					{canLoad && waitingError ? (
						<div role="alert" className="alert alert-error alert-soft">
							<p>{t('cashHandover.loadFailed')}</p>
							<button
								type="button"
								className="btn btn-sm"
								disabled={isWaitingPending}
								onClick={() => void retryWaiting()}
							>
								{t('cashHandover.retry')}
							</button>
						</div>
					) : canLoad && isWaitingPending ? (
						<span
							className="loading loading-spinner"
							aria-label={t('cashHandover.loading')}
						/>
					) : (
						(attempt || (driverId !== '' && waiting)) && (
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
										<p className="text-sm">
											{t('cashHandover.selection', {
												selected: selected.length,
												maximum: MAX_HANDOVER_PARCELS,
											})}
										</p>
										<p className="text-lg font-semibold">
											{t('cashHandover.expected')}{' '}
											<span dir="ltr">{handoverTotal(selected)}</span>
										</p>
										<Input
											label={t('cashHandover.cash')}
											name="cash"
											required
											inputMode="decimal"
											dir="ltr"
											autoComplete="off"
											value={cash}
											onChange={(event) => setCash(event.target.value)}
											readOnly={locked}
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
											value={reference}
											onChange={(event) => setReference(event.target.value)}
											readOnly={locked}
											error={
												fieldError === 'reference'
													? t('cashHandover.errors.reference')
													: undefined
											}
										/>
										{attempt && handoverError && (
											<p>{t('cashHandover.retryExact')}</p>
										)}
										<div>
											<button
												type="submit"
												className="btn btn-neutral"
												disabled={isRecording || selected.length === 0}
											>
												{t(
													attempt && handoverError
														? 'cashHandover.retryHandover'
														: 'cashHandover.submit',
												)}
											</button>
										</div>
									</form>
								)}
							</>
						)
					)}
				</div>
				<TipCard
					title={t('cashHandover.tipTitle')}
					description={t('cashHandover.tipDescription')}
				/>
			</div>
		</div>
	);
}
