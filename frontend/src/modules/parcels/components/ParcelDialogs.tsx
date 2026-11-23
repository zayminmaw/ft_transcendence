import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Input, Select, Textarea, useToast } from '@global-components';
import type { FailureReason, Parcel, StatusMove } from '../api';
import { FAILURE_REASONS } from '../constants';
import { useParcelMutations } from '../hooks/useParcelMutations';
import { parcelErrorKey } from '../errors';

// Mounted only while open, so each opening starts with an empty form and no earlier refusal.
export type ParcelDialogProps = {
	parcel: Parcel;
	onClose: () => void;
};

// A status move: the form's fields become the move the API records (it trims them, and drops empty notes). A refusal
// (e.g. someone moved the parcel first) shows in the dialog; the parcel refreshes either way.
function ParcelActionDialog({
	parcel,
	onClose,
	title,
	description,
	submitLabel,
	toastTitle,
	move,
	children,
}: ParcelDialogProps & {
	title: string;
	description: string;
	submitLabel: string;
	toastTitle: string;
	move: (field: (name: string) => string) => StatusMove;
	children: ReactNode;
}) {
	const { t } = useTranslation('parcels');
	const { toast } = useToast();
	const { moveParcel, isMoving, moveError } = useParcelMutations();
	return (
		<Dialog
			open
			onClose={onClose}
			title={title}
			description={description}
			onSubmit={(event) => {
				event.preventDefault();
				const data = new FormData(event.currentTarget);
				const field = (name: string) => String(data.get(name) ?? '');
				moveParcel(
					{ parcelId: parcel.id, move: move(field) },
					{
						onSuccess: () => {
							onClose();
							toast({ variant: 'success', title: toastTitle });
						},
					},
				);
			}}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={onClose}>
						{t('common.cancel')}
					</button>
					<button type="submit" className="btn btn-neutral" disabled={isMoving}>
						{submitLabel}
					</button>
				</>
			}
		>
			{moveError && (
				<p role="alert" className="rounded-box bg-error/10 p-4 text-sm text-error">
					{t(parcelErrorKey(moveError))}
				</p>
			)}
			{children}
		</Dialog>
	);
}

export function MarkPickedUpDialog(props: ParcelDialogProps) {
	const { t } = useTranslation('parcels');
	return (
		<ParcelActionDialog
			{...props}
			title={t('dialogs.pickedUp.title', { tracking: props.parcel.trackingNumber })}
			description={t('dialogs.pickedUp.description', { merchant: props.parcel.client.name })}
			submitLabel={t('dialogs.pickedUp.action')}
			toastTitle={t('dialogs.pickedUp.done')}
			move={(field) => ({ status: 'picked_up', notes: field('notes') })}
		>
			<Textarea name="notes" label={t('common.notes')} maxLength={2000} />
		</ParcelActionDialog>
	);
}

export function MarkInHubDialog(props: ParcelDialogProps) {
	const { t } = useTranslation('parcels');
	return (
		<ParcelActionDialog
			{...props}
			title={t('dialogs.inHub.title', { tracking: props.parcel.trackingNumber })}
			description={t('dialogs.inHub.description')}
			submitLabel={t('dialogs.inHub.action')}
			toastTitle={t('dialogs.inHub.done')}
			move={(field) => ({
				status: 'in_hub_sorted',
				hubLocation: field('hubLocation'),
				notes: field('notes'),
			})}
		>
			<Input
				name="hubLocation"
				label={t('dialogs.inHub.location')}
				required
				maxLength={128}
				placeholder={t('dialogs.inHub.placeholder')}
			/>
			<Textarea name="notes" label={t('common.notes')} maxLength={2000} />
		</ParcelActionDialog>
	);
}

export function RecordFailureDialog(props: ParcelDialogProps) {
	const { t } = useTranslation('parcels');
	return (
		<ParcelActionDialog
			{...props}
			title={t('dialogs.failure.title', { tracking: props.parcel.trackingNumber })}
			description={t('dialogs.failure.description')}
			submitLabel={t('dialogs.failure.action')}
			toastTitle={t('dialogs.failure.done')}
			move={(field) => ({
				status: 'failed_attempt',
				reasonCode: field('reasonCode') as FailureReason,
				notes: field('notes'),
			})}
		>
			<Select
				name="reasonCode"
				label={t('dialogs.failure.reason')}
				required
				options={FAILURE_REASONS.map((value) => ({
					value,
					label: t(`failureReasons.${value}`),
				}))}
			/>
			<Textarea name="notes" label={t('common.notes')} maxLength={2000} />
		</ParcelActionDialog>
	);
}

export function ReturnToSenderDialog(props: ParcelDialogProps) {
	const { t } = useTranslation('parcels');
	const { failedReasonCode } = props.parcel;
	return (
		<ParcelActionDialog
			{...props}
			title={t('dialogs.return.title', { tracking: props.parcel.trackingNumber })}
			description={t('dialogs.return.description', { merchant: props.parcel.client.name })}
			submitLabel={t('dialogs.return.action')}
			toastTitle={t('dialogs.return.done')}
			move={(field) => ({ status: 'returned_to_sender', notes: field('notes') })}
		>
			<div>
				<Textarea
					name="notes"
					label={t('dialogs.return.reason')}
					required
					maxLength={2000}
					defaultValue={failedReasonCode ? t(`failureReasons.${failedReasonCode}`) : ''}
				/>
				<p className="mt-1 text-xs text-[var(--color-slate)]">
					{t('dialogs.return.recorded')}
				</p>
			</div>
		</ParcelActionDialog>
	);
}
