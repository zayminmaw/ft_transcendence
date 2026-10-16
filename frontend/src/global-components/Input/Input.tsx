import { useId, type InputHTMLAttributes } from 'react';

export function Input({
	label,
	error,
	id,
	className = '',
	containerClassName = '',
	...props
}: InputHTMLAttributes<HTMLInputElement> & {
	label: string;
	error?: string;
	containerClassName?: string;
}) {
	const generatedId = useId();
	const inputId = id ?? generatedId;
	return (
		<div className={containerClassName}>
			<label className="mb-2 block text-sm font-medium" htmlFor={inputId}>
				{label}
				{props.required && ' *'}
			</label>
			<input
				{...props}
				id={inputId}
				aria-invalid={Boolean(error)}
				aria-describedby={error ? `${inputId}-error` : undefined}
				className={`input w-full ${error ? 'input-error' : ''} ${className}`}
			/>
			{error && (
				<p id={`${inputId}-error`} role="alert" className="mt-1 text-sm text-error">
					{error}
				</p>
			)}
		</div>
	);
}
