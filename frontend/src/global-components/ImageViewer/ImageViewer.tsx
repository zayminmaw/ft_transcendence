import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

// Click a picture to see it large. `children` is the small picture (a thumbnail or an Avatar) and becomes the button;
// `src` is the image to show large (the same link as the small one is fine, the file is stored as uploaded). `label`
// names the button and the large image, e.g. "View picture". Escape, a click beside the image, or Close shuts it.
export function ImageViewer({
	src,
	label,
	children,
	className = '',
}: {
	src: string;
	label: string;
	children: ReactNode;
	className?: string;
}) {
	const { t } = useTranslation();
	const dialog = useRef<HTMLDialogElement>(null);
	const [open, setOpen] = useState(false);
	// A link that no longer works (it expired) says so instead of showing a broken image.
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		const element = dialog.current;
		if (!element) return;
		if (open && !element.open) element.showModal();
		if (!open && element.open) element.close();
	}, [open]);

	const show = () => {
		setFailed(false);
		setOpen(true);
	};

	return (
		<>
			<button
				type="button"
				aria-label={label}
				aria-haspopup="dialog"
				className={`cursor-zoom-in rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
				onClick={show}
			>
				{children}
			</button>
			<dialog
				ref={dialog}
				className="modal"
				aria-label={label}
				// Escape and the backdrop close the native dialog; keep `open` in sync.
				onClose={() => setOpen(false)}
			>
				<div className="modal-box flex w-auto max-w-[92vw] flex-col items-center gap-3 overflow-visible bg-transparent p-0 shadow-none">
					{/* Always in place, so the picture fades out with the dialog instead of vanishing first. */}
					{failed ? (
						<p className="rounded-box bg-base-100 p-6 text-sm">
							{t('imageViewer.failed')}
						</p>
					) : (
						<img
							src={src}
							alt={label}
							className="max-h-[80vh] max-w-full rounded-box object-contain"
							onError={() => setFailed(true)}
						/>
					)}
					<button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
						{t('imageViewer.close')}
					</button>
				</div>
				<form method="dialog" className="modal-backdrop">
					<button aria-label={t('imageViewer.close')}>{t('imageViewer.close')}</button>
				</form>
			</dialog>
		</>
	);
}
