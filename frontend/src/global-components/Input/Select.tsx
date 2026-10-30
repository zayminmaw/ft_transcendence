import { useId, type SelectHTMLAttributes } from 'react';

type SelectOption = { value: string; label: string };

// A labelled dropdown for forms with its error below, like Input. List filters use SelectFilter instead.
export function Select({
	label,
	error,
	id,
	options,
	className = '',
	containerClassName = '',
	...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
	label: string;
	options: SelectOption[];
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
			<select
				{...props}
				id={fieldId}
				aria-invalid={Boolean(error)}
				aria-describedby={error ? `${fieldId}-error` : undefined}
				className={`select w-full ${error ? 'select-error' : ''} ${className}`}
			>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
			{error && (
				<p id={`${fieldId}-error`} role="alert" className="mt-1 text-sm text-error">
					{error}
				</p>
			)}
		</div>
	);
}
