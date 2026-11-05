import type { ReactNode } from 'react';
import { Dialog, Input, Select, Textarea, useToast } from '@global-components';
import type { FailureReason, Parcel, StatusMove } from '../api';
import { failureReasonLabels, failureReasons } from '../constants';
import { useParcelMutations } from '../hooks/useParcelMutations';

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
						Cancel
					</button>
					<button type="submit" className="btn btn-neutral" disabled={isMoving}>
						{submitLabel}
					</button>
				</>
			}
		>
			{moveError && (
				<p role="alert" className="rounded-box bg-error/10 p-4 text-sm text-error">
					{moveError.message}
				</p>
			)}
			{children}
		</Dialog>
	);
}

export function MarkPickedUpDialog(props: ParcelDialogProps) {
	return (
		<ParcelActionDialog
			{...props}
			title={`Mark ${props.parcel.trackingNumber} as picked up?`}
			description={`Records that the parcel was collected from ${props.parcel.client.name}.`}
			submitLabel="Mark picked up"
			toastTitle="Parcel marked as picked up"
			move={(field) => ({ status: 'picked_up', notes: field('notes') })}
		>
			<Textarea name="notes" label="Notes" maxLength={2000} />
		</ParcelActionDialog>
	);
}

export function MarkInHubDialog(props: ParcelDialogProps) {
	return (
		<ParcelActionDialog
			{...props}
			title={`Mark ${props.parcel.trackingNumber} as in hub?`}
			description="The parcel is sorted and becomes ready for driver assignment."
			submitLabel="Mark in hub"
			toastTitle="Parcel marked as in hub"
			move={(field) => ({
				status: 'in_hub_sorted',
				hubLocation: field('hubLocation'),
				notes: field('notes'),
			})}
		>
			<Input
				name="hubLocation"
				label="Hub location"
				required
				maxLength={128}
				placeholder="Central hub · Bay 3"
			/>
			<Textarea name="notes" label="Notes" maxLength={2000} />
		</ParcelActionDialog>
	);
}

export function RecordFailureDialog(props: ParcelDialogProps) {
	return (
		<ParcelActionDialog
			{...props}
			title={`Record a failed attempt for ${props.parcel.trackingNumber}?`}
			description="The parcel can then be reassigned for another attempt or returned to the merchant."
			submitLabel="Record failure"
			toastTitle="Failed attempt recorded"
			move={(field) => ({
				status: 'failed_attempt',
				reasonCode: field('reasonCode') as FailureReason,
				notes: field('notes'),
			})}
		>
			<Select name="reasonCode" label="Failure reason" required options={failureReasons} />
			<Textarea name="notes" label="Notes" maxLength={2000} />
		</ParcelActionDialog>
	);
}

export function ReturnToSenderDialog(props: ParcelDialogProps) {
	const { failedReasonCode } = props.parcel;
	return (
		<ParcelActionDialog
			{...props}
			title={`Return ${props.parcel.trackingNumber} to sender?`}
			description={`The parcel goes back to ${props.parcel.client.name}. COD is not collected and the return is recorded in the delivery history.`}
			submitLabel="Return to sender"
			toastTitle="Parcel marked for return"
			move={(field) => ({ status: 'returned_to_sender', notes: field('notes') })}
		>
			<div>
				<Textarea
					name="notes"
					label="Reason"
					required
					maxLength={2000}
					defaultValue={failedReasonCode ? failureReasonLabels[failedReasonCode] : ''}
				/>
				<p className="mt-1 text-xs text-[var(--color-slate)]">
					Recorded on the parcel with your account.
				</p>
			</div>
		</ParcelActionDialog>
	);
}
