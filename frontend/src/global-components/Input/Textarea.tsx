import { useId, type TextareaHTMLAttributes } from 'react';

// A labelled multi-line field with its error below, like Input.
export function Textarea({
	label,
	error,
	id,
	className = '',
	containerClassName = '',
	rows = 3,
	...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
	label: string;
	error?: string;
	containerClassName?: string;
}) {
	const generatedId = useId();
	const fieldId = id ?? generatedId;
	return (
		<div className={containerClassName}>
			<label className="mb-2 block text-sm font-medium" htmlFor={fieldId}>
				{label}
				{props.required && ' *'}
			</label>
			<textarea
				{...props}
				id={fieldId}
				rows={rows}
				aria-invalid={Boolean(error)}
				aria-describedby={error ? `${fieldId}-error` : undefined}
				className={`textarea w-full ${error ? 'textarea-error' : ''} ${className}`}
			/>
			{error && (
				<p id={`${fieldId}-error`} role="alert" className="mt-1 text-sm text-error">
					{error}
				</p>
			)}
		</div>
	);
}
