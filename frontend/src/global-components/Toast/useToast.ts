import { atom, useSetAtom } from 'jotai';
import { useCallback } from 'react';
import type { ToastItem, ToastOptions } from './types';

export const toastsAtom = atom<ToastItem[]>([]);

const MAX_TOASTS = 4;

export function useToast() {
	const setToasts = useSetAtom(toastsAtom);

	const dismiss = useCallback(
		(id: string) => setToasts((toasts) => toasts.filter((toast) => toast.id !== id)),
		[setToasts],
	);

	const toast = useCallback(
		({ title, description, variant = 'info', duration = 5000 }: ToastOptions) => {
			const id = crypto.randomUUID();
			setToasts((toasts) =>
				[...toasts, { id, title, description, variant, duration }].slice(-MAX_TOASTS),
			);
			return id;
		},
		[setToasts],
	);

	return { toast, dismiss };
}
