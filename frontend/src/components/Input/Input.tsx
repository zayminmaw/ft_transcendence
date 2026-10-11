import { useId, type InputHTMLAttributes } from 'react';

export function Input({ label, error, id, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
	const generatedId = useId();
	const inputId = id ?? generatedId;
	return <div>
		<label className="mb-2 block text-sm font-medium" htmlFor={inputId}>{label}</label>
		<input {...props} id={inputId} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : undefined} className={`input w-full ${error ? 'input-error' : ''} ${className}`} />
		{error && <p id={`${inputId}-error`} role="alert" className="mt-1 text-sm text-error">{error}</p>}
	</div>;
}
