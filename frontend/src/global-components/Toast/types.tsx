export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export type ToastOptions = {
	title: string;
	description?: string;
	variant?: ToastVariant;
	/** Milliseconds before auto-dismiss. Use 0 to keep it until closed. */
	duration?: number;
};

export type ToastItem = Required<Omit<ToastOptions, 'description'>> & {
	id: string;
	description?: string;
};
