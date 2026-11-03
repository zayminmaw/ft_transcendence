import type { ReactNode } from 'react';
import { Dialog, Input, Select, Textarea, useToast } from '@global-components';
import { failureReasons } from '../data/sampleParcels';
import type { Parcel } from '../data/sampleParcels';

export type ParcelDialogProps = {
	parcel: Parcel;
	open: boolean;
	onClose: () => void;
};

// Sample data until the parcel endpoints exist: confirming only shows the toast.
function ParcelActionDialog({
	open,
	onClose,
	title,
	description,
	submitLabel,
	toastTitle,
	children,
}: Omit<ParcelDialogProps, 'parcel'> & {
	title: string;
	description: string;
	submitLabel: string;
	toastTitle: string;
	children: ReactNode;
}) {
	const { toast } = useToast();
	return (
		<Dialog
			open={open}
			onClose={onClose}
			title={title}
			description={description}
			onSubmit={(event) => {
				event.preventDefault();
				onClose();
				toast({ variant: 'success', title: toastTitle });
			}}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={onClose}>
						Cancel
					</button>
					<button type="submit" className="btn btn-neutral">
						{submitLabel}
					</button>
				</>
			}
		>
			{children}
		</Dialog>
	);
}

export function MarkPickedUpDialog({ parcel, open, onClose }: ParcelDialogProps) {
	return (
		<ParcelActionDialog
			open={open}
			onClose={onClose}
			title={`Mark ${parcel.tracking} as picked up?`}
			description={`Records that the parcel was collected from ${parcel.merchant}.`}
			submitLabel="Mark picked up"
			toastTitle="Parcel marked as picked up"
		>
			<Textarea label="Notes" />
		</ParcelActionDialog>
	);
}

export function MarkInHubDialog({ parcel, open, onClose }: ParcelDialogProps) {
	return (
		<ParcelActionDialog
			open={open}
			onClose={onClose}
			title={`Mark ${parcel.tracking} as in hub?`}
			description="The parcel is sorted and becomes ready for driver assignment."
			submitLabel="Mark in hub"
			toastTitle="Parcel marked as in hub"
		>
			<Input label="Hub location" required placeholder="Central hub · Bay 3" />
			<Textarea label="Notes" />
		</ParcelActionDialog>
	);
}

export function RecordFailureDialog({ parcel, open, onClose }: ParcelDialogProps) {
	return (
		<ParcelActionDialog
			open={open}
			onClose={onClose}
			title={`Record a failed attempt for ${parcel.tracking}?`}
			description="The parcel can then be reassigned for another attempt or returned to the merchant."
			submitLabel="Record failure"
			toastTitle="Failed attempt recorded"
		>
			<Select label="Failure reason" required options={failureReasons} />
			<Textarea label="Notes" />
		</ParcelActionDialog>
	);
}

export function ReturnToSenderDialog({ parcel, open, onClose }: ParcelDialogProps) {
	return (
		<ParcelActionDialog
			open={open}
			onClose={onClose}
			title={`Return ${parcel.tracking} to sender?`}
			description={`The parcel goes back to ${parcel.merchant}. COD is not collected and the return is recorded in the delivery history.`}
			submitLabel="Return to sender"
			toastTitle="Parcel marked for return"
		>
			<div>
				<Textarea label="Reason" required defaultValue={parcel.failedReason} />
				<p className="mt-1 text-xs text-[var(--color-slate)]">
					Recorded on the parcel with your account.
				</p>
			</div>
		</ParcelActionDialog>
	);
}
