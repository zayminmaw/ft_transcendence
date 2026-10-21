import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

export function Input({
	label,
	error,
	id,
	className = '',
	containerClassName = '',
	suffix,
	...props
}: InputHTMLAttributes<HTMLInputElement> & {
	label: string;
	error?: string;
	containerClassName?: string;
	// Shown inside the field at its end, e.g. the password eye button.
	suffix?: ReactNode;
}) {
	const generatedId = useId();
	const inputId = id ?? generatedId;
	const fieldClass = `input w-full ${error ? 'input-error' : ''}`;
	// With a suffix, the wrapper is the field and the input fills it, so the button sits inside the border.
	const input = (
		<input
			{...props}
			id={inputId}
			aria-invalid={Boolean(error)}
			aria-describedby={error ? `${inputId}-error` : undefined}
			className={suffix ? className : `${fieldClass} ${className}`}
		/>
	);
	return (
		<div className={containerClassName}>
			<label className="mb-2 block text-sm font-medium" htmlFor={inputId}>
				{label}
				{props.required && ' *'}
			</label>
			{suffix ? (
				<div className={`${fieldClass} pe-1`}>
					{input}
					{suffix}
				</div>
			) : (
				input
			)}
			{error && (
				<p id={`${inputId}-error`} role="alert" className="mt-1 text-sm text-error">
					{error}
				</p>
			)}
		</div>
	);
}
