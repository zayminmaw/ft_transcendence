export type SelectFilterOption = {
	value: string;
	label: string;
};

// Compact labelled dropdown for list filters; stays on one line however many options there are.
export function SelectFilter({
	label,
	options,
	value,
	onChange,
	className = '',
}: {
	label: string;
	options: SelectFilterOption[];
	value: string;
	onChange: (value: string) => void;
	className?: string;
}) {
	return (
		<label className={`select w-full sm:w-auto ${className}`}>
			<span className="label text-[var(--color-slate)]">{label}</span>
			<select value={value} onChange={(event) => onChange(event.target.value)}>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	);
}
