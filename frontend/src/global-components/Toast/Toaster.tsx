import { useAtomValue } from 'jotai';
import { useEffect } from 'react';
import type { ToastItem, ToastVariant } from './types';
import { toastsAtom, useToast } from './useToast';

const markerClass: Record<ToastVariant, string> = {
	success: 'bg-primary',
	info: 'bg-base-300',
	warning: 'bg-warning',
	error: 'bg-error',
};

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
	useEffect(() => {
		if (toast.duration <= 0) return;
		const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
		return () => window.clearTimeout(timer);
	}, [toast.id, toast.duration, onDismiss]);

	return (
		<div
			role={toast.variant === 'error' ? 'alert' : 'status'}
			className="alert w-88 max-w-full items-start gap-3 rounded-box border-0 bg-neutral px-4 py-3 text-neutral-content shadow-[inset_0_0_0_2px_rgba(255,255,255,0.13),0_10px_38px_-12px_rgba(0,0,0,0.4)]"
		>
			<span
				aria-hidden="true"
				className={`mt-1 size-3 shrink-0 rounded-sm ${markerClass[toast.variant]}`}
			/>
			<div className="min-w-0 flex-1 text-left">
				<p className="text-sm font-medium tracking-[-0.14px]">{toast.title}</p>
				{toast.description && (
					<p className="mt-1 text-sm wrap-break-word text-neutral-content/60">
						{toast.description}
					</p>
				)}
			</div>
			<button
				type="button"
				aria-label="Dismiss notification"
				className="btn btn-ghost btn-xs -mr-1 size-6 min-h-0 rounded-sm p-0 text-neutral-content/60 hover:bg-white/10 hover:text-neutral-content"
				onClick={() => onDismiss(toast.id)}
			>
				<svg
					viewBox="0 0 16 16"
					className="size-3"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.75"
					strokeLinecap="round"
				>
					<path d="M4 4l8 8M12 4l-8 8" />
				</svg>
			</button>
		</div>
	);
}

export function Toaster() {
	const toasts = useAtomValue(toastsAtom);
	const { dismiss } = useToast();

	if (toasts.length === 0) return null;

	return (
		<div aria-live="polite" className="toast toast-end toast-top z-50">
			{toasts.map((toast) => (
				<Toast key={toast.id} toast={toast} onDismiss={dismiss} />
			))}
		</div>
	);
}
