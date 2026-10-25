import { useEffect, useId, useRef } from 'react';
import type { FormEvent, ReactNode } from 'react';

export function Dialog({
	open,
	onClose,
	title,
	description,
	children,
	actions,
	onSubmit,
	dismissible = true,
	className = '',
}: {
	open: boolean;
	onClose: () => void;
	title: string;
	description?: ReactNode;
	children?: ReactNode;
	actions?: ReactNode;
	// When set, the dialog body is a form and submit buttons in `actions` submit it.
	onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
	// false: a click beside the dialog or Escape doesn't close it, only its own buttons do (e.g. while it shows
	// something that can't be shown again).
	dismissible?: boolean;
	className?: string;
}) {
	const dialog = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const descriptionId = useId();

	useEffect(() => {
		const element = dialog.current;
		if (!element) return;
		if (open && !element.open) element.showModal();
		if (!open && element.open) element.close();
	}, [open]);

	const bodyClassName = `modal-box flex max-w-lg flex-col gap-6 p-6 md:p-8 ${className}`;
	const content = (
		<>
			<div>
				<h2 id={titleId} className="text-xl font-semibold">
					{title}
				</h2>
				{description && (
					<p id={descriptionId} className="mt-2 text-sm text-[var(--color-slate)]">
						{description}
					</p>
				)}
			</div>
			{children}
			{actions && (
				<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					{actions}
				</div>
			)}
		</>
	);

	return (
		<dialog
			ref={dialog}
			className="modal"
			aria-labelledby={titleId}
			aria-describedby={description ? descriptionId : undefined}
			// Escape and the backdrop close the native dialog; keep `open` in sync.
			onClose={onClose}
			onCancel={dismissible ? undefined : (event) => event.preventDefault()}
		>
			{onSubmit ? (
				<form className={bodyClassName} onSubmit={onSubmit}>
					{content}
				</form>
			) : (
				<div className={bodyClassName}>{content}</div>
			)}
			{dismissible && (
				<form method="dialog" className="modal-backdrop">
					<button aria-label="Close dialog">Close</button>
				</form>
			)}
		</dialog>
	);
}
